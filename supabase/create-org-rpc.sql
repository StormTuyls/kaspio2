-- ============================================================================
-- create_organisation RPC
-- ============================================================================
-- Robust org-creation: bypasst RLS via SECURITY DEFINER. Zorgt dat het profile
-- bestaat (voor users die signupten voordat handle_new_user trigger live was),
-- maakt de org aan, en zorgt dat de admin-membership er is.
--
-- Roep aan via supabase.rpc('create_organisation', { p_name: 'My Org' }).
-- Returnt het nieuwe org-id (uuid).
-- ============================================================================

create or replace function public.create_organisation(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_full_name text;
  v_email text;
  v_org_id uuid;
  v_trimmed text := trim(p_name);
begin
  if v_user is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;
  if v_trimmed = '' or v_trimmed is null then
    raise exception 'Organisatie heeft een naam nodig' using errcode = '22023';
  end if;

  -- Haal user-data uit auth.users (defensief)
  select
    coalesce(raw_user_meta_data->>'full_name', email, 'Onbekend'),
    email
  into v_full_name, v_email
  from auth.users
  where id = v_user;

  if v_email is null then
    raise exception 'Geen e-mailadres bekend voor deze user' using errcode = '23502';
  end if;

  -- Zorg dat het profile bestaat (defensief, voor users die signupten
  -- vóór de handle_new_user trigger live was).
  insert into public.profiles (id, full_name, email)
  values (v_user, coalesce(v_full_name, 'Onbekend'), v_email)
  on conflict (id) do nothing;

  -- Voorkom duplicaten: als user al een org met deze naam heeft, return die.
  select id into v_org_id
  from public.organisations
  where owner_id = v_user
    and lower(name) = lower(v_trimmed)
  limit 1;

  if v_org_id is not null then
    return v_org_id;
  end if;

  -- Maak de org aan (bypasst RLS dankzij SECURITY DEFINER)
  insert into public.organisations (name, owner_id)
  values (v_trimmed, v_user)
  returning id into v_org_id;

  -- De on_org_created trigger maakt normaal de admin-membership aan,
  -- maar voor extra zekerheid: zorg dat 'ie bestaat.
  insert into public.memberships (organisation_id, user_id, role, pot_id)
  select v_org_id, v_user, 'admin', null
  where not exists (
    select 1 from public.memberships
    where organisation_id = v_org_id
      and user_id = v_user
      and pot_id is null
  );

  return v_org_id;
end;
$$;

grant execute on function public.create_organisation(text) to authenticated;

-- ============================================================================
-- Prevent duplicate org-names per owner (case-insensitive)
-- ============================================================================
-- Een user mag niet 2x dezelfde org-naam hebben. Index met lower() voor
-- case-insensitive uniqueness. Past niet als er al duplicates bestaan ,
-- dan eerst opruimen via:
--   select owner_id, lower(name), count(*)
--     from public.organisations
--    group by owner_id, lower(name)
--   having count(*) > 1;
-- ============================================================================

create unique index if not exists organisations_owner_name_unique
  on public.organisations (owner_id, lower(name));
