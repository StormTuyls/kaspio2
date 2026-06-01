-- =============================================================================
-- Kaspio , org-level member invites
-- Run dit ALS aanvulling op supabase/schema.sql en invite-codes.sql.
-- =============================================================================

-- =============================================================================
-- 1. ORG_INVITES TABEL
-- =============================================================================

create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  role public.member_role not null default 'pot_owner',
  -- Voor pot_owner: welk potje krijgt deze persoon
  pot_id uuid references public.pots(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes (functie-call moet via aparte CREATE INDEX, niet inline UNIQUE)
create index org_invites_email_idx on public.org_invites(lower(email)) where accepted_at is null;
create index org_invites_org_idx on public.org_invites(organisation_id);

-- Case-insensitive uniciteit per org+email voor pending invites.
-- (Accepted invites mogen meerdere keren voor dezelfde email bestaan als historie.)
create unique index org_invites_org_email_pending_unique
  on public.org_invites(organisation_id, lower(email))
  where accepted_at is null;

-- Sanity check: pot_owner moet pot_id hebben, admin/reader niet
alter table public.org_invites
  add constraint org_invites_role_pot_check check (
    (role = 'pot_owner' and pot_id is not null)
    or (role in ('admin', 'reader') and pot_id is null)
  );

-- =============================================================================
-- 2. RLS , admins beheren invites voor hun eigen org
-- =============================================================================

alter table public.org_invites enable row level security;

-- Admins van de org zien alle invites voor die org
create policy "org_invites_select_for_admin"
  on public.org_invites for select
  using (public.is_org_admin(organisation_id));

-- Geinviteerde user (op email) ziet zijn eigen pending invites
-- Dit is nodig zodat de frontend kan checken of er invites zijn voor de huidige user
create policy "org_invites_select_for_invitee"
  on public.org_invites for select
  using (
    accepted_at is null
    and lower(email) = lower(coalesce(
      (select email from public.profiles where id = auth.uid()),
      ''
    ))
  );

create policy "org_invites_insert_for_admin"
  on public.org_invites for insert
  with check (public.is_org_admin(organisation_id));

create policy "org_invites_delete_for_admin"
  on public.org_invites for delete
  using (public.is_org_admin(organisation_id));

-- =============================================================================
-- 3. ACCEPT_PENDING_INVITES RPC
-- =============================================================================
-- Wordt aangeroepen door de frontend bij elke login. Vindt pending invites
-- voor het e-mail van de huidige user, maakt memberships aan, en markeert
-- de invites als accepted.
-- Returns: het aantal invites dat geaccepteerd werd.

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
    select *
    from public.org_invites
    where accepted_at is null
      and lower(email) = lower(v_email)
      and (expires_at is null or expires_at > now())
  loop
    -- Voeg lid toe (kan al bestaan als invite werd opnieuw gestuurd, vandaar on conflict)
    insert into public.memberships (organisation_id, user_id, role, pot_id, invited_by)
    values (
      v_invite.organisation_id,
      v_user_id,
      v_invite.role,
      v_invite.pot_id,
      v_invite.invited_by
    )
    on conflict (organisation_id, user_id, pot_id) do nothing;

    update public.org_invites
    set accepted_at = now(), accepted_by = v_user_id
    where id = v_invite.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.accept_pending_invites() to authenticated;

-- =============================================================================
-- 4. CREATE_ORG_INVITE HELPER , gebruiksgemak voor SQL Editor
-- =============================================================================
-- Voorbeeld (run als admin):
--   select public.create_org_invite(
--     p_org_id := '...',
--     p_email := 'jan@example.com',
--     p_role := 'pot_owner',
--     p_pot_id := '...'
--   );

create or replace function public.create_org_invite(
  p_org_id uuid,
  p_email text,
  p_role public.member_role default 'pot_owner',
  p_pot_id uuid default null,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Alleen admins van deze organisatie kunnen uitnodigingen versturen';
  end if;

  -- Soft delete bestaande pending invite voor zelfde email (voor het geval rol/potje is veranderd)
  delete from public.org_invites
  where organisation_id = p_org_id
    and lower(email) = lower(p_email)
    and accepted_at is null;

  insert into public.org_invites (organisation_id, email, role, pot_id, invited_by, expires_at)
  values (p_org_id, p_email, p_role, p_pot_id, auth.uid(), p_expires_at)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_org_invite(uuid, text, public.member_role, uuid, timestamptz)
  to authenticated;

-- =============================================================================
-- DONE
-- =============================================================================
