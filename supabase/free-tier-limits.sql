-- =============================================================================
-- Gratis tier verruimen: 5 potjes / 3 leden (was 3 / 2)
-- =============================================================================
-- Ruimere gratis tier voor een betere funnel (concurrenten geven meer gratis).
-- Werkt de twee limiet-triggers bij. create_org_invite's eigen check wordt in
-- org-invite-tokens.sql aangepast (then 2 -> then 3).
-- =============================================================================

create or replace function public.enforce_pot_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tier public.sub_tier; v_count int; v_max int;
begin
  v_tier := public.org_tier(new.organisation_id);
  v_max := case v_tier when 'free' then 5 else 1000000 end;
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

create or replace function public.enforce_member_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tier public.sub_tier; v_count int; v_max int; v_exists boolean;
begin
  select exists(
    select 1 from public.memberships
    where organisation_id = new.organisation_id and user_id = new.user_id
  ) into v_exists;
  if v_exists then return new; end if;

  v_tier := public.org_tier(new.organisation_id);
  v_max := case v_tier when 'free' then 3 else 1000000 end;
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
