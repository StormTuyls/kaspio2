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

-- ----------------------------------------------------------------------------
-- 1. log_audit() bijgewerkt: vuurt NIET tijdens een org-verwijdering.
-- ----------------------------------------------------------------------------
-- Zonder dit zou de cascade-delete van pots/transactions/memberships de
-- audit-trigger laten vuren, die een audit_log-rij invoegt naar de net-
-- verwijderde org -> FK-fout (audit_log_organisation_id_fkey). We slaan het
-- loggen over wanneer de transactie-lokale flag 'kaspio.skip_audit' = 'on' staat.

create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_action text;
begin
  -- Skip auditing tijdens bulk-opruim (bv. org-verwijdering).
  if coalesce(current_setting('kaspio.skip_audit', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  -- Bepaal organisation_id afhankelijk van de tabel
  if tg_table_name = 'pots' then
    v_org_id = coalesce(new.organisation_id, old.organisation_id);
  elsif tg_table_name = 'transactions' then
    v_org_id = coalesce(new.organisation_id, old.organisation_id);
  elsif tg_table_name = 'memberships' then
    v_org_id = coalesce(new.organisation_id, old.organisation_id);
  else
    return coalesce(new, old);
  end if;

  v_action = tg_table_name || '_' || lower(tg_op);

  insert into public.audit_log (organisation_id, user_id, action, entity_type, entity_id, metadata)
  values (
    v_org_id,
    auth.uid(),
    v_action,
    tg_table_name,
    coalesce(new.id, old.id),
    case
      when tg_op = 'INSERT' then jsonb_build_object('after', row_to_json(new))
      when tg_op = 'UPDATE' then jsonb_build_object('before', row_to_json(old), 'after', row_to_json(new))
      when tg_op = 'DELETE' then jsonb_build_object('before', row_to_json(old))
    end
  );

  return coalesce(new, old);
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. delete_organisation
-- ----------------------------------------------------------------------------

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

  -- Zet de audit-trigger uit voor deze transactie, anders FK-fout op audit_log.
  perform set_config('kaspio.skip_audit', 'on', true);

  delete from public.organisations where id = p_org_id;  -- cascade ruimt de rest
end;
$$;

grant execute on function public.delete_organisation(uuid) to authenticated;
