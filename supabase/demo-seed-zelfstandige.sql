-- =============================================================================
-- Demo-account: vierde org voor een andere doelgroep (kleine zelfstandige)
-- =============================================================================
-- Voegt een VIERDE organisatie toe aan dezelfde demo-login (demo@kaspio.be): een
-- zelfstandige die getufte tapijten en wandkleden maakt (tufting). Geen leden,
-- maar één zaakrekening verdeeld in potjes. Toont envelope-budgeting voor een
-- eenmanszaak: BTW en sociale bijdragen opzij zetten, materiaal, atelier, loon.
--
-- VOORAF: dezelfde demo-user moet bestaan (zie demo-seed.sql). Raakt de andere
-- demo-orgs NIET. Idempotent. Draai in de Supabase SQL-editor.
-- =============================================================================

do $$
declare
  v_owner uuid;
  v_org   uuid;
  g_res uuid; g_atelier uuid; g_prive uuid;
  p_btw uuid; p_soc uuid; p_bel uuid;
  p_grond uuid; p_gereed uuid; p_atelierkost uuid;
  p_loon uuid; p_buffer uuid;
begin
  select id into v_owner from public.profiles where lower(email) = lower('demo@kaspio.be');
  if v_owner is null then
    raise exception
      'Geen profiel voor demo@kaspio.be. Maak die user eerst aan (Authentication > Add user) en draai demo-seed.sql.';
  end if;

  perform set_config('kaspio.skip_audit', 'on', true);

  delete from public.organisations
   where owner_id = v_owner and name = 'Studio Tuft (demo)';

  insert into public.organisations (name, owner_id)
  values ('Studio Tuft (demo)', v_owner)
  returning id into v_org;

  insert into public.subscriptions (organisation_id, tier, status, comped)
  values (v_org, 'team', 'active', true)
  on conflict (organisation_id) do update
    set tier = 'team', status = 'active', comped = true;

  -- potgroepen
  insert into public.pot_groups (organisation_id, name, sort_order) values (v_org, 'Reserveringen', 0) returning id into g_res;
  insert into public.pot_groups (organisation_id, name, sort_order) values (v_org, 'Atelier',       1) returning id into g_atelier;
  insert into public.pot_groups (organisation_id, name, sort_order) values (v_org, 'Privé',         2) returning id into g_prive;

  -- potjes
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'BTW (21%)',          '#DC2626', g_res,     null, 'BTW opzij tot de kwartaalaangifte.') returning id into p_btw;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Sociale bijdragen',  '#F59E0B', g_res,     null, 'Kwartaalbijdrage sociaal verzekeringsfonds.') returning id into p_soc;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Belastingbuffer',    '#7C3AED', g_res,     null, 'Reserve voor de personenbelasting.') returning id into p_bel;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Grondstoffen',       '#16A34A', g_atelier, null, 'Tuftgaren, tuftdoek, lijm en afwerking.') returning id into p_grond;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Gereedschap',        '#2563EB', g_atelier, null, 'Tuftguns, naalden, onderdelen.') returning id into p_gereed;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Atelierkosten',      '#0891B2', g_atelier, null, 'Huur atelierruimte en energie.') returning id into p_atelierkost;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Eigen loon',         '#1D9E75', g_prive,   null, 'Wat de zaak maandelijks naar privé overschrijft.') returning id into p_loon;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Spaarbuffer',        '#DB2777', g_prive,   null, 'Buffer voor magere maanden.') returning id into p_buffer;

  -- transacties (feb t/m apr 2026): omzet opgesplitst + reele uitgaven
  insert into public.transactions
    (organisation_id, pot_id, amount, direction, occurred_on, memo, counterparty, created_by) values
    -- BTW (21%) opzij + afdracht
    (v_org, p_btw,    380.00, 'in',  '2026-02-28', 'BTW opzij - omzet februari',      'Reservering',              v_owner),
    (v_org, p_btw,    420.00, 'in',  '2026-03-31', 'BTW opzij - omzet maart',         'Reservering',              v_owner),
    (v_org, p_btw,    510.00, 'in',  '2026-04-30', 'BTW opzij - omzet april',         'Reservering',              v_owner),
    (v_org, p_btw,    980.00, 'out', '2026-04-20', 'BTW-afdracht Q1',                 'FOD Financiën',            v_owner),
    -- Sociale bijdragen
    (v_org, p_soc,    250.00, 'in',  '2026-02-28', 'Opzij sociale bijdragen',         'Reservering',              v_owner),
    (v_org, p_soc,    250.00, 'in',  '2026-03-31', 'Opzij sociale bijdragen',         'Reservering',              v_owner),
    (v_org, p_soc,    250.00, 'in',  '2026-04-30', 'Opzij sociale bijdragen',         'Reservering',              v_owner),
    (v_org, p_soc,    720.00, 'out', '2026-03-20', 'Sociale bijdragen Q1',            'Liantis',                  v_owner),
    -- Belastingbuffer
    (v_org, p_bel,    200.00, 'in',  '2026-02-28', 'Opzij personenbelasting',         'Reservering',              v_owner),
    (v_org, p_bel,    200.00, 'in',  '2026-03-31', 'Opzij personenbelasting',         'Reservering',              v_owner),
    (v_org, p_bel,    200.00, 'in',  '2026-04-30', 'Opzij personenbelasting',         'Reservering',              v_owner),
    -- Grondstoffen
    (v_org, p_grond,  500.00, 'in',  '2026-02-10', 'Budget grondstoffen',             'Reservering',              v_owner),
    (v_org, p_grond,  215.40, 'out', '2026-02-14', 'Tuftgaren (wol en acryl)',        'De Wolfabriek',            v_owner),
    (v_org, p_grond,  142.00, 'out', '2026-03-18', 'Primary tuftdoek 5m',             'Tuftshop.eu',              v_owner),
    (v_org, p_grond,   96.50, 'out', '2026-05-02', 'Lijm en afwerkdoek',              'Tuftshop.eu',              v_owner),
    -- Gereedschap
    (v_org, p_gereed, 700.00, 'in',  '2026-02-01', 'Budget gereedschap',              'Reservering',              v_owner),
    (v_org, p_gereed, 540.00, 'out', '2026-02-08', 'Cut & loop tuftgun',              'Tuftshop.eu',              v_owner),
    (v_org, p_gereed,  85.00, 'out', '2026-04-22', 'Reserveonderdelen en naalden',    'Tuftshop.eu',              v_owner),
    -- Atelierkosten
    (v_org, p_atelierkost, 900.00, 'in',  '2026-02-01', 'Budget atelier',             'Reservering',              v_owner),
    (v_org, p_atelierkost, 350.00, 'out', '2026-02-05', 'Huur atelierruimte februari','Verhuurder',               v_owner),
    (v_org, p_atelierkost, 350.00, 'out', '2026-03-05', 'Huur atelierruimte maart',   'Verhuurder',               v_owner),
    (v_org, p_atelierkost,  78.30, 'out', '2026-03-12', 'Elektriciteit atelier',      'Fluvius',                  v_owner),
    -- Eigen loon (omzet binnen, loon naar privé)
    (v_org, p_loon,   850.00, 'in',  '2026-02-25', 'Verkoop wandkleed + workshop',    'Webshop',                  v_owner),
    (v_org, p_loon,  1100.00, 'in',  '2026-03-28', 'Markt + online verkoop',          'Markt Gent',               v_owner),
    (v_org, p_loon,  1300.00, 'in',  '2026-04-26', 'Workshops + verkoop',             'Workshops',                v_owner),
    (v_org, p_loon,  1200.00, 'out', '2026-03-01', 'Eigen loon februari',             'Overschrijving privé',     v_owner),
    (v_org, p_loon,  1200.00, 'out', '2026-04-01', 'Eigen loon maart',                'Overschrijving privé',     v_owner),
    -- Spaarbuffer
    (v_org, p_buffer, 150.00, 'in',  '2026-02-25', 'Buffer opzij',                    'Reservering',              v_owner),
    (v_org, p_buffer, 150.00, 'in',  '2026-03-28', 'Buffer opzij',                    'Reservering',              v_owner),
    (v_org, p_buffer, 200.00, 'in',  '2026-04-26', 'Buffer opzij',                    'Reservering',              v_owner);

  raise notice 'Zelfstandige-demo klaar: % (owner %, 3 groepen, 8 potjes, 30 transacties).', v_org, v_owner;
end $$;
