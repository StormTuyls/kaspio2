-- =============================================================================
-- Kaspio , prognose naast budget
-- =============================================================================
-- Een potje had tot nu één streefbedrag: target_amount, te lezen als spaardoel
-- of als uitgavenbudget. Dat is genoeg zolang je plan het hele jaar hetzelfde
-- blijft. In de praktijk is dat het niet.
--
-- De clubs die hun cijfers in Excel bijhouden zetten er twee kolommen naast
-- elkaar: wat we in januari afgesproken hebben, en wat we er vandaag van
-- verwachten. Het eerste ligt vast, dat is waar de algemene vergadering ja op
-- zei. Het tweede schuift mee: een trainer valt weg, de winter is zacht, de
-- ballon gaat later open. Wie die twee door elkaar haalt verliest precies de
-- informatie waar een bestuur op stuurt, namelijk het verschil ertussen.
--
-- Vandaar een aparte kolom in plaats van target_amount overschrijven. Budget
-- blijft het vastgeklopte cijfer, prognose is de bijgestelde verwachting.
--
-- NULL betekent "geen prognose ingesteld", en dan valt de UI terug op het
-- budget. Zo verandert er niets voor wie hier geen behoefte aan heeft.
--
-- Het teken volgt target_amount: voor een budgetpotje is het bedrag positief
-- (het plafond) en voor een spaardoel het beoogde saldo, dat negatief mag zijn.
--
-- Idempotent. Draai in de Supabase SQL-editor.
-- =============================================================================

alter table public.pots
  add column if not exists forecast_amount numeric(12, 2);

comment on column public.pots.forecast_amount is
  'Bijgestelde verwachting voor dit potje, naast het vastgelegde '
  'target_amount. NULL = geen prognose, dan geldt het budget. Zelfde teken- en '
  'leesregels als target_amount (zie pots.target_kind).';

-- Verificatie:
--   select name, target_kind, target_amount, forecast_amount
--     from public.pots
--    where forecast_amount is not null;
-- =============================================================================
