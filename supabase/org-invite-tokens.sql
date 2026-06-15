-- =============================================================================
-- Kaspio , org-invite TOKENS
-- Run dit NA org-invites.sql en member-management.sql.
-- =============================================================================
-- Maakt org-invites token-gebaseerd. Eén unieke link koppelt een user aan
-- precies die organisatie (met de juiste rol + potjes), zonder afhankelijk te
-- zijn van e-mail-matching. De token vervangt ook de aparte beta-code: wie een
-- geldige invite-link heeft, mag een account aanmaken én wordt lid van die org.
--
-- Flow:
--   1. Admin maakt invite  -> create_org_invite() returnt een token.
--   2. Link: https://kaspio.be/?invite=<token>
--   3. Signup-scherm valideert via lookup_org_invite() (anon, closed-beta bypass).
--   4. Bij eerste login: redeem_org_invite() koppelt de user aan die org.
-- =============================================================================

-- =============================================================================
-- 1. TOKEN-KOLOM
-- =============================================================================

alter table public.org_invites add column if not exists token text;

create unique index if not exists org_invites_token_unique
  on public.org_invites(token) where token is not null;

-- Backfill: geef bestaande openstaande invites alsnog een token.
update public.org_invites
set token = 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
where token is null and accepted_at is null;

-- =============================================================================
-- 2. CREATE_ORG_INVITE , genereert token en returnt die (text i.p.v. uuid)
-- =============================================================================

drop function if exists public.create_org_invite(uuid, text, public.member_role, uuid[], timestamptz);

create or replace function public.create_org_invite(
  p_org_id uuid,
  p_email text,
  p_role public.member_role default 'pot_owner',
  p_pot_ids uuid[] default null,
  p_expires_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Alleen admins van deze organisatie kunnen uitnodigingen versturen';
  end if;

  if p_role = 'pot_owner' and (p_pot_ids is null or array_length(p_pot_ids, 1) = 0) then
    raise exception 'Pot owner moet minstens één potje toegewezen krijgen';
  end if;

  -- Soft delete bestaande pending invite voor zelfde email (rol/potjes kan veranderd zijn).
  delete from public.org_invites
  where organisation_id = p_org_id
    and lower(email) = lower(p_email)
    and accepted_at is null;

  v_token := 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

  insert into public.org_invites (organisation_id, email, role, pot_ids, invited_by, expires_at, token)
  values (p_org_id, p_email, p_role, p_pot_ids, auth.uid(), p_expires_at, v_token);

  return v_token;
end;
$$;

grant execute on function public.create_org_invite(uuid, text, public.member_role, uuid[], timestamptz)
  to authenticated;

-- =============================================================================
-- 3. LOOKUP_ORG_INVITE , anon-safe validatie + prefill voor het signup-scherm
-- =============================================================================
-- Returnt jsonb: { status, email, role, org_name }.
-- status: 'ok' | 'not_found' | 'expired' | 'accepted'

create or replace function public.lookup_org_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_org_name text;
begin
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_inv from public.org_invites where token = p_token;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_inv.accepted_at is not null then
    return jsonb_build_object('status', 'accepted');
  end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select name into v_org_name from public.organisations where id = v_inv.organisation_id;

  return jsonb_build_object(
    'status', 'ok',
    'email', v_inv.email,
    'role', v_inv.role,
    'org_name', coalesce(v_org_name, 'een organisatie')
  );
end;
$$;

grant execute on function public.lookup_org_invite(text) to anon, authenticated;

-- =============================================================================
-- 4. REDEEM_ORG_INVITE , koppelt de ingelogde user aan precies die org
-- =============================================================================
-- Geen e-mail-match: de token is het bewijs van de uitnodiging.
-- Returnt text: 'ok' | 'not_authenticated' | 'not_found' | 'expired' | 'accepted'

create or replace function public.redeem_org_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_inv record;
  v_full_name text;
  v_email text;
  v_pot_id uuid;
begin
  if v_user is null then
    return 'not_authenticated';
  end if;
  if p_token is null or trim(p_token) = '' then
    return 'not_found';
  end if;

  select * into v_inv from public.org_invites where token = p_token;
  if not found then
    return 'not_found';
  end if;
  if v_inv.accepted_at is not null then
    return 'accepted';
  end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    return 'expired';
  end if;

  -- Zorg dat het profile bestaat (defensief, net als create_organisation).
  select coalesce(raw_user_meta_data->>'full_name', email, 'Onbekend'), email
    into v_full_name, v_email
  from auth.users where id = v_user;
  insert into public.profiles (id, full_name, email)
  values (v_user, coalesce(v_full_name, 'Onbekend'), coalesce(v_email, ''))
  on conflict (id) do nothing;

  -- Maak membership(s) , multi-pot aware, identiek aan accept_pending_invites.
  if v_inv.role = 'pot_owner' then
    if v_inv.pot_ids is not null and array_length(v_inv.pot_ids, 1) > 0 then
      foreach v_pot_id in array v_inv.pot_ids loop
        insert into public.memberships (organisation_id, user_id, role, pot_id, invited_by)
        values (v_inv.organisation_id, v_user, 'pot_owner', v_pot_id, v_inv.invited_by)
        on conflict (organisation_id, user_id, pot_id) do nothing;
      end loop;
    elsif v_inv.pot_id is not null then
      insert into public.memberships (organisation_id, user_id, role, pot_id, invited_by)
      values (v_inv.organisation_id, v_user, 'pot_owner', v_inv.pot_id, v_inv.invited_by)
      on conflict (organisation_id, user_id, pot_id) do nothing;
    end if;
  else
    insert into public.memberships (organisation_id, user_id, role, invited_by)
    values (v_inv.organisation_id, v_user, v_inv.role, v_inv.invited_by)
    on conflict (organisation_id, user_id, pot_id) do nothing;
  end if;

  update public.org_invites
  set accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;

  return 'ok';
end;
$$;

grant execute on function public.redeem_org_invite(text) to authenticated;

-- =============================================================================
-- DONE , verificatie:
--   select public.lookup_org_invite('NIET-BESTAAND');  -> {"status":"not_found"}
-- =============================================================================
