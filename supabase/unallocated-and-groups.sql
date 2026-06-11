-- =============================================================================
-- Migratie: onverdeeld geld + potgroepen
-- Run dit volledig in de Supabase SQL Editor (na schema.sql en de andere files).
-- =============================================================================
-- Deel 1: transacties zonder potje ("Toe te wijzen" inbox)
--   - pot_id wordt nullable: NULL = geld dat nog geen potje heeft
--   - pot verwijderen vernietigt transacties niet meer, ze vallen terug
--     naar "toe te wijzen" (SET NULL i.p.v. CASCADE)
--   - split_from: trace naar de originele transactie bij splitsen
--   - RLS: onverdeelde transacties zijn alleen zichtbaar/beheerbaar voor admins
--
-- Deel 2: potgroepen (takken, ploegen, werkgroepen)
--   - pot_groups tabel + pots.group_id (nullable, plat, geen nesting)
-- =============================================================================

-- =============================================================================
-- DEEL 1: ONVERDEELD GELD
-- =============================================================================

-- 1a. pot_id nullable + FK van CASCADE naar SET NULL
alter table public.transactions
  alter column pot_id drop not null;

alter table public.transactions
  drop constraint if exists transactions_pot_id_fkey;

alter table public.transactions
  add constraint transactions_pot_id_fkey
  foreign key (pot_id) references public.pots(id) on delete set null;

-- 1b. split_from: verwijst naar de originele transactie waar deze uit
--     gesplitst is. Puur voor traceerbaarheid, geen logica aan gekoppeld.
alter table public.transactions
  add column if not exists split_from uuid references public.transactions(id) on delete set null;

-- 1c. RLS bijwerken: NULL pot_id = alleen admins van de org.
--     can_view_pot(NULL) / can_write_pot(NULL) geven false, dus zonder deze
--     aanpassing zou onverdeeld geld voor iederéén onzichtbaar zijn.

drop policy if exists "transactions_select_for_pot_viewers" on public.transactions;
create policy "transactions_select_for_pot_viewers"
  on public.transactions for select
  using (
    (pot_id is not null and public.can_view_pot(pot_id))
    or (pot_id is null and public.is_org_admin(organisation_id))
  );

drop policy if exists "transactions_insert_for_pot_writers" on public.transactions;
create policy "transactions_insert_for_pot_writers"
  on public.transactions for insert
  with check (
    (pot_id is not null and public.can_write_pot(pot_id))
    or (pot_id is null and public.is_org_admin(organisation_id))
  );

drop policy if exists "transactions_update_for_pot_writers" on public.transactions;
create policy "transactions_update_for_pot_writers"
  on public.transactions for update
  using (
    (pot_id is not null and public.can_write_pot(pot_id))
    or (pot_id is null and public.is_org_admin(organisation_id))
  )
  with check (
    (pot_id is not null and public.can_write_pot(pot_id))
    or (pot_id is null and public.is_org_admin(organisation_id))
  );

-- delete-policy was al org-admin-based, die blijft zoals 'ie is.

-- =============================================================================
-- DEEL 2: POTGROEPEN
-- =============================================================================

-- 2a. Tabel: platte groepen binnen een org (tak, ploeg, werkgroep)
create table if not exists public.pot_groups (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists pot_groups_org_idx on public.pot_groups(organisation_id);

-- Geen twee groepen met dezelfde naam binnen één org (case-insensitive)
create unique index if not exists pot_groups_org_name_unique
  on public.pot_groups (organisation_id, lower(name));

-- 2b. Koppeling op pots. Groep verwijderen = potjes worden gewoon groepsloos.
alter table public.pots
  add column if not exists group_id uuid references public.pot_groups(id) on delete set null;

create index if not exists pots_group_idx on public.pots(group_id) where group_id is not null;

-- 2c. RLS: leden lezen, admins beheren
alter table public.pot_groups enable row level security;

drop policy if exists "pot_groups_select_for_org_members" on public.pot_groups;
create policy "pot_groups_select_for_org_members"
  on public.pot_groups for select
  using (public.is_org_member(organisation_id));

drop policy if exists "pot_groups_insert_for_admin" on public.pot_groups;
create policy "pot_groups_insert_for_admin"
  on public.pot_groups for insert
  with check (public.is_org_admin(organisation_id));

drop policy if exists "pot_groups_update_for_admin" on public.pot_groups;
create policy "pot_groups_update_for_admin"
  on public.pot_groups for update
  using (public.is_org_admin(organisation_id))
  with check (public.is_org_admin(organisation_id));

drop policy if exists "pot_groups_delete_for_admin" on public.pot_groups;
create policy "pot_groups_delete_for_admin"
  on public.pot_groups for delete
  using (public.is_org_admin(organisation_id));

-- =============================================================================
-- VERIFICATIE
-- =============================================================================
--   select is_nullable from information_schema.columns
--     where table_name = 'transactions' and column_name = 'pot_id';  -- YES
--   select count(*) from pg_policies where tablename = 'pot_groups'; -- 4
