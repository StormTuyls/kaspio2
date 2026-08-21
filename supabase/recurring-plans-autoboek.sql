-- =============================================================================
-- Migratie: automatisch reserveren bij terugkerende boekingen
-- Run dit in de Supabase SQL Editor NA supabase/recurring-plans.sql.
-- Idempotent: veilig om opnieuw te draaien.
-- =============================================================================
-- Twee toevoegingen:
--
--   reserve_day  Alleen voor 'domiciliering'. Zet je die, dan hoort de
--                domiciliëring zichzelf te financieren: op die dag verschuift
--                Kaspio het bedrag uit de hoofdpot (onverdeeld) naar het potje.
--                De echte afhouding haalt het er later weer uit via de
--                bankimport. Zo hoef je geen aparte 'storting' meer te maken,
--                maar dat blijft wél gewoon mogelijk.
--
--   auto_book    Aan = Kaspio boekt de reservering zelf zodra de dag bereikt
--                is. Uit = de reservering verschijnt onder "Te bevestigen" op
--                het dashboard en jij klikt "Boek".
--
-- Let op: enkel de reservering (hoofdpot -> potje) wordt ooit automatisch geboekt.
-- De echte afhouding boekt Kaspio nooit zelf; die komt via de bankimport binnen,
-- anders zou ze dubbel tellen.
-- =============================================================================

alter table public.recurring_plans
  add column if not exists reserve_day int
  check (reserve_day is null or (reserve_day between 1 and 31));

alter table public.recurring_plans
  add column if not exists auto_book boolean not null default true;

-- Verificatie:
--   select pot_id, kind, amount, day_of_month, reserve_day, auto_book, last_run_on
--   from public.recurring_plans;
