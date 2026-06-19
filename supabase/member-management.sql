-- =============================================================================
-- Kaspio , member management (multi-pot + role wijziging)
-- Run dit ALS aanvulling op schema.sql, invite-codes.sql, org-invites.sql.
-- =============================================================================

-- =============================================================================
-- 1. Multi-pot ondersteuning in org_invites
-- =============================================================================

alter table public.org_invites add column if not exists pot_ids uuid[];

-- Drop oude check constraint die alleen single pot_id toeliet
alter table public.org_invites
  drop constraint if exists org_invites_role_pot_check;

-- Nieuwe check: pot_owner moet of pot_id OF pot_ids hebben, admin/reader geen pot
alter table public.org_invites
  add constraint org_invites_role_pot_check check (
    (role = 'pot_owner' and (pot_id is not null or (pot_ids is not null and array_length(pot_ids, 1) > 0)))
    or (role in ('admin', 'reader') and pot_id is null and pot_ids is null)
  );

-- =============================================================================
-- 2. SET_MEMBER_PERMISSIONS RPC
-- =============================================================================
-- Atomic permission-update voor één user binnen één org.
-- Vervangt alle bestaande memberships van die user door wat in deze call staat.
-- Returns: 'ok', of error-string als iets verkeerd ging.

create or replace function public.set_member_permissions(
  p_org_id uuid,
  p_user_id uuid,
  p_role public.member_role,
  p_pot_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_count int;
  v_was_admin boolean;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Alleen org-admins kunnen rechten wijzigen';
  end if;

  if p_role = 'pot_owner' and (p_pot_ids is null or array_length(p_pot_ids, 1) = 0) then
    raise exception 'Pot owner moet minstens één potje toegewezen krijgen';
  end if;

  -- Was deze user voor de wijziging admin?
  select exists(
    select 1 from public.memberships
    where organisation_id = p_org_id and user_id = p_user_id and role = 'admin'
  ) into v_was_admin;

  -- Hoeveel ANDERE admins blijven er na deze wijziging?
  select count(*) into v_admin_count
  from public.memberships
  where organisation_id = p_org_id
    and role = 'admin'
    and user_id != p_user_id;

  -- Bescherming: minstens één admin moet overblijven
  if v_was_admin and p_role != 'admin' and v_admin_count = 0 then
    raise exception 'Kan laatste admin niet degraderen. Wijs eerst iemand anders aan als admin.';
  end if;

  -- Wis alle bestaande memberships voor deze user in deze org
  delete from public.memberships
  where organisation_id = p_org_id and user_id = p_user_id;

  -- Voeg nieuwe toe op basis van rol
  if p_role = 'admin' then
    insert into public.memberships (organisation_id, user_id, role)
    values (p_org_id, p_user_id, 'admin');
  elsif p_role = 'reader' then
    insert into public.memberships (organisation_id, user_id, role)
    values (p_org_id, p_user_id, 'reader');
  elsif p_role = 'pot_owner' then
    insert into public.memberships (organisation_id, user_id, role, pot_id)
    select p_org_id, p_user_id, 'pot_owner', unnest(p_pot_ids);
  end if;
end;
$$;

grant execute on function public.set_member_permissions(uuid, uuid, public.member_role, uuid[])
  to authenticated;

-- =============================================================================
-- 3. REMOVE_MEMBER RPC , user volledig uit org halen
-- =============================================================================

create or replace function public.remove_member(
  p_org_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_admin boolean;
  v_admin_count int;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Alleen org-admins kunnen leden verwijderen';
  end if;

  select exists(
    select 1 from public.memberships
    where organisation_id = p_org_id and user_id = p_user_id and role = 'admin'
  ) into v_was_admin;

  select count(*) into v_admin_count
  from public.memberships
  where organisation_id = p_org_id and role = 'admin' and user_id != p_user_id;

  if v_was_admin and v_admin_count = 0 then
    raise exception 'Kan laatste admin niet verwijderen';
  end if;

  delete from public.memberships
  where organisation_id = p_org_id and user_id = p_user_id;
end;
$$;

grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- =============================================================================
-- 4. CREATE_ORG_INVITE , VERPLAATST naar org-invite-tokens.sql
-- =============================================================================
-- De canonieke definitie staat nu in supabase/org-invite-tokens.sql (returnt
-- een token (text) i.p.v. uuid, met token + ledenlimietcheck). Hier NIET meer
-- definiëren, anders botst het returntype (uuid vs text) afhankelijk van de
-- volgorde waarin je de bestanden draait.

-- =============================================================================
-- 5. ACCEPT_PENDING_INVITES update , maakt multi-pot memberships
-- =============================================================================

create or replace function public.accept_pending_invites()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
  v_invite record;
  v_count int := 0;
  v_pot_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return 0;
  end if;

  select email into v_email from public.profiles where id = v_user_id;
  if v_email is null then
    return 0;
  end if;

  for v_invite in
    select * from public.org_invites
    where accepted_at is null
      and lower(email) = lower(v_email)
      and (expires_at is null or expires_at > now())
  loop
    if v_invite.role = 'pot_owner' then
      -- Multi-pot: één membership per potje
      if v_invite.pot_ids is not null and array_length(v_invite.pot_ids, 1) > 0 then
        foreach v_pot_id in array v_invite.pot_ids loop
          insert into public.memberships (organisation_id, user_id, role, pot_id, invited_by)
          values (v_invite.organisation_id, v_user_id, 'pot_owner', v_pot_id, v_invite.invited_by)
          on conflict (organisation_id, user_id, pot_id) do nothing;
        end loop;
      elsif v_invite.pot_id is not null then
        -- Backward compat: legacy single pot_id
        insert into public.memberships (organisation_id, user_id, role, pot_id, invited_by)
        values (v_invite.organisation_id, v_user_id, 'pot_owner', v_invite.pot_id, v_invite.invited_by)
        on conflict (organisation_id, user_id, pot_id) do nothing;
      end if;
    else
      -- admin/reader: pot_id is NULL, on conflict dedupt niet bij NULL -> guarden.
      insert into public.memberships (organisation_id, user_id, role, invited_by)
      select v_invite.organisation_id, v_user_id, v_invite.role, v_invite.invited_by
      where not exists (
        select 1 from public.memberships
        where organisation_id = v_invite.organisation_id
          and user_id = v_user_id
          and pot_id is null
      );
    end if;

    update public.org_invites
    set accepted_at = now(), accepted_by = v_user_id
    where id = v_invite.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- =============================================================================
-- DONE
-- =============================================================================
