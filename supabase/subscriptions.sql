-- =============================================================================
-- Licenties / abonnementen , subscriptions + server-side limiet-afdwinging
-- =============================================================================
-- Eén subscription per org (default 'free'). Limieten worden afgedwongen via
-- BEFORE INSERT triggers op pots en memberships, dus niemand kan ze via de API
-- omzeilen. Het tier wordt alleen door de Stripe-webhook (service role) gezet;
-- clients kunnen 'subscriptions' lezen maar niet schrijven.
--
-- Limieten:
--   Gratis : max 3 potjes, max 2 leden
--   Pro    : onbeperkt potjes, onbeperkt leden
--   Team   : onbeperkt potjes, onbeperkt leden (+ extra functies)
-- =============================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'sub_tier') then
    create type public.sub_tier as enum ('free', 'pro', 'team');
  end if;
  if not exists (select 1 from pg_type where typname = 'sub_status') then
    create type public.sub_status as enum ('active', 'trialing', 'past_due', 'canceled');
  end if;
end $$;

create table if not exists public.subscriptions (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  tier public.sub_tier not null default 'free',
  status public.sub_status not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_for_members" on public.subscriptions;
create policy "subscriptions_select_for_members"
  on public.subscriptions for select
  using (public.is_org_member(organisation_id));
-- Geen insert/update/delete policies: clients kunnen niet schrijven. De
-- Stripe-webhook gebruikt de service role en omzeilt RLS.

-- ----- Elke org krijgt automatisch een (gratis) subscription -----
create or replace function public.ensure_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (organisation_id, tier)
  values (new.id, 'free')
  on conflict (organisation_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_org_created_subscription on public.organisations;
create trigger on_org_created_subscription
  after insert on public.organisations
  for each row execute function public.ensure_subscription();

-- Backfill bestaande orgs
insert into public.subscriptions (organisation_id, tier)
select id, 'free' from public.organisations
on conflict (organisation_id) do nothing;

-- ----- Helper: actief tier van een org (default free) -----
create or replace function public.org_tier(p_org uuid)
returns public.sub_tier language sql stable security definer set search_path = public as $$
  select coalesce(
    (select tier from public.subscriptions
       where organisation_id = p_org and status in ('active', 'trialing')),
    'free'
  )::public.sub_tier;
$$;

-- Wordt uitsluitend aangeroepen vanuit andere SECURITY DEFINER- en
-- triggerfuncties (free-tier-limits, groups-tier-gate, attachments,
-- approval-flows, org-invite-tokens). Die draaien als eigenaar en houden dus
-- EXECUTE, ook als de client niets mag. Hoort niet in de REST-API te staan, en
-- staat in de live database ook dicht.
revoke all on function public.org_tier(uuid) from public, anon, authenticated;

-- ----- Potjes-limiet -----
create or replace function public.enforce_pot_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tier public.sub_tier; v_count int; v_max int;
begin
  v_tier := public.org_tier(new.organisation_id);
  v_max := case v_tier when 'free' then 3 else 1000000 end;
  select count(*) into v_count
  from public.pots
  where organisation_id = new.organisation_id and archived = false;
  if v_count >= v_max then
    raise exception
      'Je gratis plan staat maximaal % potjes toe. Upgrade naar Pro voor onbeperkt.', v_max
      using errcode = '23514';
  end if;
  return new;
end; $$;

drop trigger if exists enforce_pot_limit_trigger on public.pots;
create trigger enforce_pot_limit_trigger
  before insert on public.pots
  for each row execute function public.enforce_pot_limit();

-- ----- Leden-limiet (telt unieke users; extra pot_owner-rijen tellen niet mee) -----
create or replace function public.enforce_member_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tier public.sub_tier; v_count int; v_max int; v_exists boolean;
begin
  select exists(
    select 1 from public.memberships
    where organisation_id = new.organisation_id and user_id = new.user_id
  ) into v_exists;
  if v_exists then return new; end if;  -- bestaande user, geen extra seat

  v_tier := public.org_tier(new.organisation_id);
  -- Enkel het gratis plan is geplafonneerd; betaalde plannen zijn onbeperkt.
  v_max := case v_tier when 'free' then 2 else 1000000 end;
  select count(distinct user_id) into v_count
  from public.memberships
  where organisation_id = new.organisation_id;
  if v_count >= v_max then
    raise exception
      'Ledenlimiet bereikt voor dit plan (max %). Upgrade voor meer leden.', v_max
      using errcode = '23514';
  end if;
  return new;
end; $$;

drop trigger if exists enforce_member_limit_trigger on public.memberships;
create trigger enforce_member_limit_trigger
  before insert on public.memberships
  for each row execute function public.enforce_member_limit();

-- ----- Realtime zodat tier-wijzigingen (na Stripe) live doorkomen -----
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'subscriptions'
  ) then
    alter publication supabase_realtime add table public.subscriptions;
  end if;
end $$;
alter table public.subscriptions replica identity full;

-- Verificatie:
--   select organisation_id, tier from public.subscriptions;
--   select tgname from pg_trigger where tgname like 'enforce_%';
