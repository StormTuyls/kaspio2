-- =============================================================================
-- Kaspio , rekening op de bankregel
-- =============================================================================
-- Kaspio ging tot nu uit van één bankrekening per organisatie. Dat houdt op te
-- kloppen zodra een club met meerdere rekeningen werkt (een clubrekening, een
-- lesgeldenrekening, een barrekening). Twee dingen gaan dan stuk:
--
--   1. Je kan niet meer zien op welke rekening een verrichting stond, dus je
--      kan een import ook niet meer tegen één afschrift afvinken.
--   2. Overboekingen tussen eigen rekeningen ("aanzuivering") komen binnen als
--      echte inkomsten op de ene en echte uitgaven op de andere rekening. Die
--      verdubbelen je in- en uitstroom terwijl er netto niets gebeurde.
--
-- Deze migratie lost (1) op met één kolom, en maakt (2) oplosbaar: de import
-- kan nu de twee benen van een interne overboeking herkennen en aan elkaar
-- knopen met het bestaande transfer_group. Regels met een transfer_group houdt
-- de frontend al buiten de in/uit-cashflow.
--
-- Bewust GEEN aparte bank_accounts-tabel. De rekening is hier tekst zoals ze op
-- het afschrift staat. Een echte rekening-entiteit (met naam, saldo, eigenaar)
-- is een grotere stap; die willen we pas zetten als blijkt dat er per rekening
-- iets berekend moet worden. Tot dan is een IBAN als tekst genoeg om op te
-- filteren en op te matchen.
--
-- Idempotent. Draai in de Supabase SQL-editor. Geen RLS-wijziging nodig: de
-- kolom erft de bestaande policies op public.transactions.
-- =============================================================================

alter table public.transactions
  add column if not exists bank_account text;

-- Filteren op rekening binnen een organisatie is de enige query die we op deze
-- kolom doen. Partieel, want bij bestaande rijen is de kolom leeg.
create index if not exists transactions_bank_account_idx
  on public.transactions(organisation_id, bank_account)
  where bank_account is not null;

comment on column public.transactions.bank_account is
  'Rekening waarop deze verrichting stond, zoals op het afschrift (IBAN). '
  'NULL voor regels die Kaspio zelf maakte (verdelingen, reserveringen, '
  'overboekingen tussen potjes) en voor imports van voor deze kolom bestond.';

-- Verificatie:
--   select bank_account, count(*)
--     from public.transactions
--    group by bank_account
--    order by count(*) desc;
-- =============================================================================
