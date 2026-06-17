-- =============================================================================
-- Kaspio — database schema
-- Run dit volledig in Supabase SQL Editor (één keer, eerste setup).
-- =============================================================================

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================================
-- 2. PROFILES (extension of auth.users)
-- =============================================================================
-- Supabase Auth beheert de auth.users tabel zelf (email, hashed password, etc).
-- We voegen er een 'profiles'-rij aan toe voor app-data zoals full_name.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'User profiles, één-op-één met auth.users. Auto-gevuld via trigger op signup.';

-- =============================================================================
-- 3. ORGANISATIONS
-- =============================================================================

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organisations_owner_idx on public.organisations(owner_id);

-- =============================================================================
-- 4. POTS
-- =============================================================================

create table public.pots (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  color text not null default '#1D9E75' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  target_amount numeric(12, 2),
  description text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pots_org_idx on public.pots(organisation_id);
create index pots_active_idx on public.pots(organisation_id) where archived = false;

-- =============================================================================
-- 5. MEMBERSHIPS
-- =============================================================================
-- Een gebruiker kan in meerdere organisaties zitten, met verschillende rollen.
-- Voor 'pot_owner' rol koppelen we ook een specifiek potje.

create type public.member_role as enum ('admin', 'pot_owner', 'reader');

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null,
  -- pot_id is alleen relevant voor pot_owner; nullable voor admin/reader
  pot_id uuid references public.pots(id) on delete cascade,
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  -- Eén persoon kan niet 2x in dezelfde org zitten (per pot kan wel)
  unique (organisation_id, user_id, pot_id)
);

create index memberships_user_idx on public.memberships(user_id);
create index memberships_org_idx on public.memberships(organisation_id);
create index memberships_pot_idx on public.memberships(pot_id) where pot_id is not null;

-- Constraint: pot_owner moet een pot_id hebben; admin/reader niet
alter table public.memberships
  add constraint memberships_role_pot_check check (
    (role = 'pot_owner' and pot_id is not null)
    or (role in ('admin', 'reader') and pot_id is null)
  );

-- =============================================================================
-- 6. TRANSACTIONS
-- =============================================================================

create type public.txn_direction as enum ('in', 'out');

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  direction public.txn_direction not null,
  occurred_on date not null default current_date,
  memo text,
  counterparty text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index transactions_pot_idx on public.transactions(pot_id, occurred_on desc);
create index transactions_org_idx on public.transactions(organisation_id, occurred_on desc);

-- =============================================================================
-- 7. AUDIT LOG
-- =============================================================================

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_org_idx on public.audit_log(organisation_id, created_at desc);

-- =============================================================================
-- 8. NOTIFICATION SETTINGS
-- =============================================================================

create table public.notification_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_new_income boolean not null default true,
  email_low_balance boolean not null default true,
  email_digest_weekly boolean not null default false,
  email_pending_approval boolean not null default true,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- 9. HELPER FUNCTIONS (gebruikt door RLS policies)
-- =============================================================================

-- Is de huidige user lid van deze organisatie (in welke rol dan ook)?
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.memberships
    where organisation_id = org_id
      and user_id = auth.uid()
  );
$$;

-- Is de huidige user admin van deze organisatie?
create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.memberships
    where organisation_id = org_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- Kan de huidige user dit potje zien?
--   Admins zien alle potjes in hun org. Readers ook (read-only).
--   Pot owners zien enkel hun eigen potje.
create or replace function public.can_view_pot(p_pot_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.pots p
    join public.memberships m on m.organisation_id = p.organisation_id
    where p.id = p_pot_id
      and m.user_id = auth.uid()
      and (
        m.role in ('admin', 'reader')
        or (m.role = 'pot_owner' and m.pot_id = p.id)
      )
  );
$$;

-- Kan de huidige user transacties toevoegen aan dit potje?
--   Admins altijd. Pot owners enkel voor hun eigen potje. Readers niet.
create or replace function public.can_write_pot(p_pot_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.pots p
    join public.memberships m on m.organisation_id = p.organisation_id
    where p.id = p_pot_id
      and m.user_id = auth.uid()
      and (
        m.role = 'admin'
        or (m.role = 'pot_owner' and m.pot_id = p.id)
      )
  );
$$;

-- =============================================================================
-- 10. ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.pots enable row level security;
alter table public.memberships enable row level security;
alter table public.transactions enable row level security;
alter table public.audit_log enable row level security;
alter table public.notification_settings enable row level security;

-- ----- PROFILES -----
-- Iedereen kan zijn eigen profiel zien en bewerken.
-- Andere leden van dezelfde org kunnen elkaars profile naam zien (voor "wie deed wat").
create policy "profiles_select_self_or_org_member"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.memberships m1
      join public.memberships m2 on m1.organisation_id = m2.organisation_id
      where m1.user_id = auth.uid()
        and m2.user_id = profiles.id
    )
  );

create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_insert_self"
  on public.profiles for insert
  with check (id = auth.uid());

-- ----- ORGANISATIONS -----
create policy "organisations_select_for_members"
  on public.organisations for select
  using (public.is_org_member(id));

create policy "organisations_insert_authenticated"
  on public.organisations for insert
  with check (auth.uid() = owner_id);

create policy "organisations_update_for_admin"
  on public.organisations for update
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

create policy "organisations_delete_for_owner"
  on public.organisations for delete
  using (owner_id = auth.uid());

-- ----- POTS -----
create policy "pots_select_for_org_members"
  on public.pots for select
  using (public.can_view_pot(id));

create policy "pots_insert_for_admin"
  on public.pots for insert
  with check (public.is_org_admin(organisation_id));

create policy "pots_update_for_admin"
  on public.pots for update
  using (public.is_org_admin(organisation_id))
  with check (public.is_org_admin(organisation_id));

create policy "pots_delete_for_admin"
  on public.pots for delete
  using (public.is_org_admin(organisation_id));

-- ----- MEMBERSHIPS -----
-- Leden zien alle membership-rijen in hun eigen org.
create policy "memberships_select_for_org_members"
  on public.memberships for select
  using (public.is_org_member(organisation_id));

-- Enkel admins voegen leden toe / wijzigen rollen.
create policy "memberships_insert_for_admin"
  on public.memberships for insert
  with check (public.is_org_admin(organisation_id));

create policy "memberships_update_for_admin"
  on public.memberships for update
  using (public.is_org_admin(organisation_id))
  with check (public.is_org_admin(organisation_id));

create policy "memberships_delete_for_admin"
  on public.memberships for delete
  using (public.is_org_admin(organisation_id));

-- ----- TRANSACTIONS -----
create policy "transactions_select_for_pot_viewers"
  on public.transactions for select
  using (public.can_view_pot(pot_id));

create policy "transactions_insert_for_pot_writers"
  on public.transactions for insert
  with check (public.can_write_pot(pot_id));

create policy "transactions_update_for_pot_writers"
  on public.transactions for update
  using (public.can_write_pot(pot_id))
  with check (public.can_write_pot(pot_id));

create policy "transactions_delete_for_admin"
  on public.transactions for delete
  using (public.is_org_admin(organisation_id));

-- ----- AUDIT LOG -----
-- Iedereen in de org kan de audit-log lezen (transparantie).
create policy "audit_log_select_for_org_members"
  on public.audit_log for select
  using (public.is_org_member(organisation_id));

-- INSERTs gebeuren via triggers (security definer), niet via clients direct.
create policy "audit_log_no_direct_insert"
  on public.audit_log for insert
  with check (false);

-- ----- NOTIFICATION SETTINGS -----
create policy "notification_settings_self_only"
  on public.notification_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =============================================================================
-- 11. TRIGGERS
-- =============================================================================

-- ----- 11a. Auto-create profile bij signup -----
-- Wanneer een nieuwe rij in auth.users verschijnt, maken we automatisch
-- een profiles-rij + notification_settings-rij aan.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );

  insert into public.notification_settings (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----- 11b. Auto-add owner als admin bij org-creatie -----
create or replace function public.add_owner_as_admin()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.memberships (organisation_id, user_id, role)
  values (new.id, new.owner_id, 'admin');
  return new;
end;
$$;

create trigger on_org_created
  after insert on public.organisations
  for each row execute function public.add_owner_as_admin();

-- ----- 11c. Auto-update timestamps -----
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger touch_organisations_updated_at
  before update on public.organisations
  for each row execute function public.touch_updated_at();

create trigger touch_pots_updated_at
  before update on public.pots
  for each row execute function public.touch_updated_at();

create trigger touch_notification_settings_updated_at
  before update on public.notification_settings
  for each row execute function public.touch_updated_at();

-- ----- 11d. Auto-fill audit log bij key mutations -----
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
as $$
declare
  v_org_id uuid;
  v_action text;
begin
  -- Skip auditing tijdens bulk-opruim (bv. org-verwijdering), anders FK-fout
  -- op audit_log naar de net-verwijderde org.
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

create trigger audit_pots
  after insert or update or delete on public.pots
  for each row execute function public.log_audit();

create trigger audit_transactions
  after insert or update or delete on public.transactions
  for each row execute function public.log_audit();

create trigger audit_memberships
  after insert or update or delete on public.memberships
  for each row execute function public.log_audit();

-- =============================================================================
-- 12. VIEWS (handig voor frontend queries)
-- =============================================================================

-- Saldo per potje (som van transacties)
create or replace view public.pot_balances as
select
  p.id as pot_id,
  p.organisation_id,
  p.name,
  p.color,
  p.target_amount,
  coalesce(sum(case when t.direction = 'in' then t.amount else -t.amount end), 0) as balance,
  count(t.id) as transaction_count
from public.pots p
left join public.transactions t on t.pot_id = p.id
where p.archived = false
group by p.id;

-- =============================================================================
-- DONE
-- =============================================================================
-- Verificatie:
--   select count(*) from pg_policies where schemaname = 'public'; -- moet ~20+ zijn
--   select count(*) from pg_trigger where tgname like '%audit%'; -- moet 3 zijn
