-- =============================================================================
-- Migratie: terugkerende boekingen (recurring_plans)
-- Run dit volledig in de Supabase SQL Editor (na schema.sql en de andere files).
-- =============================================================================
-- Twee soorten terugkerende geldstromen rond een potje:
--
--   'storting'      = intern: elke maand geld uit de hoofdpot (onverdeeld) naar een
--                     potje reserveren. Wordt met één klik geboekt (net-nul move,
--                     via allocateFromCard). last_run_on voorkomt dubbel boeken
--                     binnen dezelfde maand.
--
--   'domiciliering' = extern: een vaste afhouding (bv. verzekering) die de bank
--                     echt doet. Kaspio boekt die NOOIT zelf (dat zou dubbel
--                     tellen met de bankimport). Het plan toont enkel een
--                     reservering op het potje en helpt de echte transactie te
--                     herkennen bij import (tegenpartij + bedrag + datumvenster).
--
-- day_of_month = de dag waarop de storting/domiciliering verwacht wordt (1-31).
-- =============================================================================

create table if not exists public.recurring_plans (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  pot_id uuid not null references public.pots(id) on delete cascade,
  kind text not null check (kind in ('storting', 'domiciliering')),
  amount numeric(12,2) not null check (amount > 0),
  day_of_month int not null check (day_of_month between 1 and 31),
  -- Naam/tegenpartij: verplicht voor domiciliering (nodig om te herkennen bij
  -- import), optioneel label voor een storting.
  counterparty text,
  -- Datumtolerantie (dagen) rond day_of_month bij het herkennen van de import.
  match_window_days int not null default 5 check (match_window_days between 0 and 15),
  active boolean not null default true,
  -- Laatst geboekte storting (YYYY-MM-DD). Alleen relevant voor 'storting'.
  last_run_on date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists recurring_plans_org_idx
  on public.recurring_plans (organisation_id);
create index if not exists recurring_plans_pot_idx
  on public.recurring_plans (pot_id);

alter table public.recurring_plans enable row level security;

-- Leden van de org zien de plannen (reserveringen zijn zichtbaar); enkel admins
-- beheren ze. Consistent met wie het onverdeelde geld / de hoofdpot beheert.
drop policy if exists "recurring_plans_select_for_members" on public.recurring_plans;
create policy "recurring_plans_select_for_members"
  on public.recurring_plans for select
  using (public.is_org_member(organisation_id));

drop policy if exists "recurring_plans_write_for_admin" on public.recurring_plans;
create policy "recurring_plans_write_for_admin"
  on public.recurring_plans for all
  using (public.is_org_admin(organisation_id))
  with check (public.is_org_admin(organisation_id));

-- Realtime zodat plannen live doorkomen in alle tabbladen.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recurring_plans'
  ) then
    alter publication supabase_realtime add table public.recurring_plans;
  end if;
end $$;
alter table public.recurring_plans replica identity full;

-- Verificatie:
--   select pot_id, kind, amount, day_of_month, counterparty, active from public.recurring_plans;
