-- =============================================================================
-- Migratie: verdeel-preset (distribution_shares)
-- Run dit volledig in de Supabase SQL Editor (na schema.sql en de andere files).
-- =============================================================================
-- Een org-brede preset: per potje een percentage van het "nog te verdelen" geld
-- op de kaart. Wordt met één klik toegepast ("Verdeel volgens %"): het onverdeelde
-- geld wordt over de potjes verdeeld op basis van deze percentages.
--
-- De verdeling zelf gebeurt in de app als gekoppelde transacties (één 'out' op de
-- kaart / onverdeeld, één 'in' per potje, met hetzelfde transfer_group). Netto nul
-- op de rekening; enkel de verdeling over de potjes verschuift. Deze tabel bewaart
-- enkel de standaard-percentages, niet de historiek.
-- =============================================================================

create table if not exists public.distribution_shares (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  pot_id uuid not null references public.pots(id) on delete cascade,
  -- Percentage van het te verdelen bedrag (0 < percent <= 100). De app bewaakt
  -- dat de som over alle potjes van één org niet boven 100% gaat.
  percent numeric(5,2) not null check (percent > 0 and percent <= 100),
  created_at timestamptz not null default now(),
  -- Eén rij per potje per org: de preset is een verzameling {potje -> percent}.
  unique (organisation_id, pot_id)
);

create index if not exists distribution_shares_org_idx
  on public.distribution_shares (organisation_id);

alter table public.distribution_shares enable row level security;

-- Leden van de org zien de preset (zodat de verdeling zichtbaar is); enkel
-- admins beheren ze (aanmaken/wijzigen/verwijderen). Consistent met wie het
-- onverdeelde geld beheert.
drop policy if exists "distribution_shares_select_for_members" on public.distribution_shares;
create policy "distribution_shares_select_for_members"
  on public.distribution_shares for select
  using (public.is_org_member(organisation_id));

drop policy if exists "distribution_shares_write_for_admin" on public.distribution_shares;
create policy "distribution_shares_write_for_admin"
  on public.distribution_shares for all
  using (public.is_org_admin(organisation_id))
  with check (public.is_org_admin(organisation_id));

-- Realtime zodat een gewijzigde preset live doorkomt in alle tabbladen.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'distribution_shares'
  ) then
    alter publication supabase_realtime add table public.distribution_shares;
  end if;
end $$;
alter table public.distribution_shares replica identity full;

-- Verificatie:
--   select organisation_id, pot_id, percent from public.distribution_shares;
