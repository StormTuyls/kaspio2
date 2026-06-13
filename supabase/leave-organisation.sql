-- =============================================================================
-- leave_organisation RPC , een lid verlaat zelf een organisatie
-- =============================================================================
-- Verwijdert alle membership-rijen van de huidige user in deze org. Weigert als:
--   - de user de eigenaar is (die moet de org verwijderen, niet verlaten), of
--   - de user de enige beheerder is (anders blijft de org stuurloos achter).
-- SECURITY DEFINER zodat de delete los van de RLS-policies werkt, maar de functie
-- checkt auth.uid() expliciet en kan alleen je eigen lidmaatschap verwijderen.
-- =============================================================================

create or replace function public.leave_organisation(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_owner boolean;
  v_admin_count int;
  v_caller_is_admin boolean;
begin
  if v_user is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;

  select (owner_id = v_user) into v_is_owner
  from public.organisations where id = p_org_id;

  if v_is_owner is null then
    raise exception 'Organisatie bestaat niet' using errcode = '42704';
  end if;
  if v_is_owner then
    raise exception 'Je bent de eigenaar. Verwijder de organisatie in plaats van ze te verlaten.'
      using errcode = '42501';
  end if;

  select
    count(*) filter (where role = 'admin'),
    bool_or(user_id = v_user and role = 'admin')
  into v_admin_count, v_caller_is_admin
  from public.memberships
  where organisation_id = p_org_id;

  if coalesce(v_caller_is_admin, false) and v_admin_count <= 1 then
    raise exception 'Je bent de enige beheerder. Maak eerst iemand anders beheerder.'
      using errcode = '42501';
  end if;

  delete from public.memberships
  where organisation_id = p_org_id and user_id = v_user;
end;
$$;

grant execute on function public.leave_organisation(uuid) to authenticated;
