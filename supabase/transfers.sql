-- =============================================================================
-- Overboeking tussen potjes
-- =============================================================================
-- Een transfer verschuift geld van het ene potje naar het andere zonder dat er
-- netto iets je rekening in- of uitgaat. We modelleren dat als TWEE gekoppelde
-- transactieregels (een "uit" op het bronpotje en een "in" op het doelpotje)
-- met hetzelfde transfer_group. De frontend sluit transfers uit van de in/uit-
-- cashflow op het dashboard, zodat interne verschuivingen die cijfers niet
-- vertekenen. De potsaldo's veranderen wél (dat is net de bedoeling).
--
-- Idempotent. Draai in de Supabase SQL-editor. Geen RLS-wijziging nodig: de
-- kolom erft de bestaande policies op public.transactions.
-- =============================================================================

alter table public.transactions
  add column if not exists transfer_group uuid;

-- Snel de twee benen van een transfer terugvinden (bv. om samen te verwijderen).
create index if not exists transactions_transfer_group_idx
  on public.transactions(transfer_group)
  where transfer_group is not null;
