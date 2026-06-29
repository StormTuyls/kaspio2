-- =============================================================================
-- Operator/founder analyse-views (Storm, niet voor klanten)
-- =============================================================================
-- Doel: zicht op de business (orgs, users, tiers, groei, upgrade-leads) zonder
-- een admin-UI te bouwen. Draai deze SELECTs in de Supabase SQL-editor.
--
-- VEILIGHEID:
--  * Deze views staan in het schema `admin`, NIET in `public`. Supabase stelt
--    standaard enkel `public` bloot via PostgREST, dus ze zijn niet via de API
--    bereikbaar. Voeg `admin` NOOIT toe aan de exposed schemas.
--  * Het zijn gewone views: ze draaien met owner-rechten en omzeilen RLS (dat is
--    net de bedoeling voor cross-org analyse). Daarom extra: alle rechten
--    ingetrokken voor anon/authenticated. De SQL-editor draait als een
--    geprivilegieerde rol en blijft werken.
--  * Bevat e-mailadressen en omzet-indicatie: behandel als PII.
--
-- Gebruik (voorbeelden):
--   select * from admin.kpis;
--   select * from admin.org_overview order by created_at desc;
--   select * from admin.free_orgs_near_limit;        -- warmste upgrade-leads
--   select * from admin.signups_weekly order by week_start desc;
--   select * from admin.inactive_orgs;               -- onboarding drop-off
--   select * from admin.user_overview order by created_at desc;
--
-- Idempotent: veilig om opnieuw te draaien (create or replace + if not exists).
-- =============================================================================

create schema if not exists admin;
revoke all on schema admin from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 1. Eén rij per org: tier, leden, potjes, activiteit, saldo.
-- -----------------------------------------------------------------------------
create or replace view admin.org_overview as
select
  o.id                                   as org_id,
  o.name                                 as org_name,
  o.created_at,
  ow.email                               as owner_email,
  coalesce(s.tier, 'free')               as tier,
  s.status                               as sub_status,
  coalesce(s.comped, false)              as comped,
  s.current_period_end,
  (select count(distinct m.user_id)
     from public.memberships m
    where m.organisation_id = o.id)      as members,
  (select count(*)
     from public.pots p
    where p.organisation_id = o.id
      and p.archived = false)            as active_pots,
  (select count(*)
     from public.transactions t
    where t.organisation_id = o.id)      as tx_count,
  (select coalesce(sum(
            case when t.status <> 'pending'
                 then case when t.direction = 'in' then t.amount else -t.amount end
                 else 0 end), 0)
     from public.transactions t
    where t.organisation_id = o.id)      as approved_balance,
  (select max(t.created_at)
     from public.transactions t
    where t.organisation_id = o.id)      as last_tx_at
from public.organisations o
left join public.subscriptions s on s.organisation_id = o.id
left join public.profiles ow      on ow.id = o.owner_id;

-- -----------------------------------------------------------------------------
-- 2. Headline-cijfers in één rij (snelle blik).
-- -----------------------------------------------------------------------------
create or replace view admin.kpis as
select
  count(*)                                                          as total_orgs,
  count(*) filter (where tier <> 'free')                           as paying_or_team_orgs,
  count(*) filter (where comped)                                    as comped_orgs,
  count(*) filter (where tier = 'free' and not comped)             as free_orgs,
  count(*) filter (where last_tx_at >= now() - interval '30 days') as active_orgs_30d,
  count(*) filter (where tx_count = 0)                             as orgs_zero_tx,
  (select count(*) from public.profiles)                           as total_users,
  coalesce(sum(approved_balance), 0)                               as total_balance_managed
from admin.org_overview;

-- -----------------------------------------------------------------------------
-- 3. Tier-verdeling (betaald vs comped).
-- -----------------------------------------------------------------------------
create or replace view admin.tier_distribution as
select
  tier,
  comped,
  count(*) as orgs
from admin.org_overview
group by tier, comped
order by tier, comped;

-- -----------------------------------------------------------------------------
-- 4. Aanmeldingen per week (groeicurve).
-- -----------------------------------------------------------------------------
create or replace view admin.signups_weekly as
select
  date_trunc('week', created_at)::date as week_start,
  count(*)                             as new_orgs
from public.organisations
group by 1
order by 1;

-- -----------------------------------------------------------------------------
-- 5. Gratis orgs die tegen de limiet zitten: de warmste upgrade-leads.
--    Gratis tier = 5 potjes / 3 leden (free-tier-limits.sql).
-- -----------------------------------------------------------------------------
create or replace view admin.free_orgs_near_limit as
select
  org_id,
  org_name,
  owner_email,
  members,
  active_pots,
  (3 - members)     as members_headroom,
  (5 - active_pots) as pots_headroom,
  last_tx_at
from admin.org_overview
where tier = 'free' and not comped
  and (active_pots >= 4 or members >= 2)   -- 'near' = op 1 na de limiet
order by active_pots desc, members desc;

-- -----------------------------------------------------------------------------
-- 6. Inactieve orgs: nooit een transactie, of niets in de laatste 30 dagen.
--    Onboarding drop-off / kandidaat voor een nudge.
-- -----------------------------------------------------------------------------
create or replace view admin.inactive_orgs as
select
  org_id,
  org_name,
  owner_email,
  tier,
  created_at,
  tx_count,
  last_tx_at,
  case when last_tx_at is null then null
       else (now()::date - last_tx_at::date) end as days_since_last_tx
from admin.org_overview
where last_tx_at is null
   or last_tx_at < now() - interval '30 days'
order by created_at desc;

-- -----------------------------------------------------------------------------
-- 7. User-overzicht: één rij per geregistreerde gebruiker.
--    (Transacties hebben geen created_by, dus geen per-user activiteit hier.)
-- -----------------------------------------------------------------------------
create or replace view admin.user_overview as
select
  pr.id        as user_id,
  pr.email,
  pr.created_at,
  (select count(distinct m.organisation_id)
     from public.memberships m
    where m.user_id = pr.id)                            as org_count,
  (select count(*)
     from public.organisations o
    where o.owner_id = pr.id)                           as orgs_owned,
  (select array_agg(distinct m.role::text)
     from public.memberships m
    where m.user_id = pr.id)                            as roles
from public.profiles pr;

-- -----------------------------------------------------------------------------
-- Rechten: enkel geprivilegieerde rollen. Nooit anon/authenticated.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema admin from anon, authenticated;
grant usage on schema admin to service_role;
grant select on all tables in schema admin to service_role;
