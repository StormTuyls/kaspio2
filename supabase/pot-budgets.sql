-- =============================================================================
-- Kaspio , budgetpotjes: doelbedrag of uitgavenbudget per potje
-- =============================================================================
-- Een potje kon tot nu toe alleen een spaardoel hebben: een positief bedrag
-- waar het saldo naartoe moet groeien. Voor zuivere kostenposten (vaste kosten,
-- bedrijfskosten) is dat het verkeerde model. Daar wil je opvolgen hoeveel van
-- een budget al uitgegeven is.
--
-- target_kind bepaalt hoe target_amount gelezen wordt:
--   'saving' : saldodoel. Voortgang = saldo / target_amount.
--   'budget' : uitgavenplafond. Voortgang = som van uitgaven / |target_amount|.
--
-- target_amount mag ook negatief zijn. Bij 'saving' is dat een doelsaldo onder
-- nul (een potje dat volgens plan in het rood staat), bij 'budget' wordt het
-- absolute bedrag gebruikt. Er staat bewust geen check-constraint op het teken.
-- =============================================================================

alter table public.pots
  add column if not exists target_kind text not null default 'saving';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'pots_target_kind_check'
  ) then
    alter table public.pots
      add constraint pots_target_kind_check
      check (target_kind in ('saving', 'budget'));
  end if;
end $$;

-- Bestaande potjes worden spaardoelen: dat doet de default op de nieuwe kolom,
-- dus er is geen backfill nodig.

-- Verificatie:
--   select name, target_amount, target_kind from public.pots order by name;
-- =============================================================================
