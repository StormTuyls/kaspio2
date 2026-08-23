-- =============================================================================
-- Testscenario: geld dat nog in de hoofdpot staat
-- =============================================================================
-- De demo-seeds wijzen alles netjes toe, dus daarmee valt er niets te testen
-- aan de hoofdpot. Dit zet in Scouts Sint-Joris een realistische inbox neer:
-- vier inkomsten zonder potje en één uitgave zonder potje.
--
-- Idempotent: draai het gerust opnieuw.
-- =============================================================================

do $$
declare
  v_org uuid;
begin
  select id into v_org from public.organisations
   where name = 'Scouts Sint-Joris (demo)' limit 1;
  if v_org is null then
    raise notice 'demo-org niet gevonden, scenario overgeslagen';
    return;
  end if;

  delete from public.transactions
   where organisation_id = v_org
     and pot_id is null
     and counterparty like '[TEST]%';

  insert into public.transactions
    (organisation_id, pot_id, direction, amount, occurred_on, counterparty, memo)
  values
    (v_org, null, 'in',  1000.00, '2026-06-01', '[TEST] Lidgelden juni',   'Vier gezinnen'),
    (v_org, null, 'in',   250.00, '2026-06-08', '[TEST] Papierophaling',   'Opbrengst'),
    (v_org, null, 'in',   612.50, '2026-06-15', '[TEST] Gemeentesubsidie', 'Werkingstoelage'),
    (v_org, null, 'in',    37.50, '2026-06-20', '[TEST] Gift',             'Anoniem'),
    (v_org, null, 'out',  120.00, '2026-06-22', '[TEST] Verzekering',      'Nog toe te wijzen');
end $$;

-- Wat er nu in de hoofdpot staat.
select count(*) filter (where transfer_group is null) as inbox_rijen,
       sum(case when direction = 'in' then amount else -amount end) as hoofdpot
  from public.transactions
 where pot_id is null;
