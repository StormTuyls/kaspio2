-- =============================================================================
-- Kaspio , prijsmodel-update: onbeperkte leden op Pro én Team
-- Run dit NA subscriptions.sql.
-- =============================================================================
-- Nieuw model:
--   Gratis : max 3 potjes, max 2 leden, geen grafieken/bank
--   Pro    : onbeperkt potjes + leden (1 org)            , €3,99/mnd
--   Team   : onbeperkt potjes + leden + extra functies   , €10/mnd
--
-- Enkel de leden-limiet verandert (Pro/Team waren 5/25, nu onbeperkt). De
-- potjes-limiet (gratis = 3, betaald = onbeperkt) blijft ongewijzigd.
-- =============================================================================

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
      'Ledenlimiet bereikt voor dit plan (max %). Upgrade naar Pro voor onbeperkt.', v_max
      using errcode = '23514';
  end if;
  return new;
end; $$;

-- Trigger zelf blijft hetzelfde (verwijst naar de functie); geen herregistratie nodig.

-- Verificatie:
--   select public.org_tier(id), * from public.subscriptions;  -- tiers bekijken
-- =============================================================================
