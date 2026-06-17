-- =============================================================================
-- delete_organisation RPC , eigenaar verwijdert een hele organisatie
-- =============================================================================
-- Alleen de eigenaar (owner_id) kan de org verwijderen. Door de
-- `on delete cascade` op alle org-gekoppelde tabellen (pots, memberships,
-- transactions, audit_log, org_invites, pot_groups, subscriptions) wordt al
-- die data automatisch mee opgeruimd. Onomkeerbaar.
--
-- Roep aan via supabase.rpc('delete_organisation', { p_org_id: '...' }).
-- =============================================================================

create or replace function public.delete_organisation(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
begin
  if v_user is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;

  select owner_id into v_owner from public.organisations where id = p_org_id;
  if v_owner is null then
    raise exception 'Organisatie bestaat niet' using errcode = '42704';
  end if;
  if v_owner <> v_user then
    raise exception 'Alleen de eigenaar kan de organisatie verwijderen'
      using errcode = '42501';
  end if;

  delete from public.organisations where id = p_org_id;  -- cascade ruimt de rest
end;
$$;

grant execute on function public.delete_organisation(uuid) to authenticated;
