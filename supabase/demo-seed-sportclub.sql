-- =============================================================================
-- Demo-account: tweede org voor een andere doelgroep (amateur-sportclub)
-- =============================================================================
-- Voegt een TWEEDE organisatie toe aan dezelfde demo-login (demo@kaspio.be),
-- zodat je in de demo de org-switcher kunt tonen en laten zien dat Kaspio voor
-- meer dan jeugdbewegingen werkt. Een voetbalclub gebruikt andere taal:
-- ploegen i.p.v. takken, kantine-inkomsten, sponsoring, scheidsrechters.
--
-- VOORAF: dezelfde demo-user moet bestaan (zie demo-seed.sql). Dit script raakt
-- de scouts-org NIET; het beheert enkel de org met de naam hieronder.
-- Idempotent: ruimt de bestaande sportclub-demo eerst op. Draai in de SQL-editor.
-- =============================================================================

do $$
declare
  v_owner uuid;
  v_org   uuid;
  g_werking uuid;
  g_ploegen uuid;
  p_kant uuid; p_uit uuid; p_sch uuid; p_ver uuid;
  p_u11 uuid; p_u15 uuid; p_eerste uuid; p_dames uuid;
begin
  select id into v_owner from public.profiles where lower(email) = lower('demo@kaspio.be');
  if v_owner is null then
    raise exception
      'Geen profiel voor demo@kaspio.be. Maak die user eerst aan (Authentication > Add user) en draai demo-seed.sql.';
  end if;

  perform set_config('kaspio.skip_audit', 'on', true);

  delete from public.organisations
   where owner_id = v_owner and name = 'VK De Meeuwen (demo)';

  insert into public.organisations (name, owner_id)
  values ('VK De Meeuwen (demo)', v_owner)
  returning id into v_org;

  insert into public.subscriptions (organisation_id, tier, status, comped)
  values (v_org, 'team', 'active', true)
  on conflict (organisation_id) do update
    set tier = 'team', status = 'active', comped = true;

  -- potgroepen
  insert into public.pot_groups (organisation_id, name, sort_order)
    values (v_org, 'Werking', 0) returning id into g_werking;
  insert into public.pot_groups (organisation_id, name, sort_order)
    values (v_org, 'Ploegen', 1) returning id into g_ploegen;

  -- potjes
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Kantine',          '#16A34A', g_werking, null, 'Baromzet en drankaankopen.') returning id into p_kant;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Uitrusting',       '#2563EB', g_werking, null, 'Truitjes, ballen, terreinmateriaal.') returning id into p_uit;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Scheidsrechters',  '#DC2626', g_werking, null, 'Vergoedingen en boetes KBVB.') returning id into p_sch;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Verplaatsingen',   '#7C3AED', g_werking, null, 'Bus en brandstof voor uitwedstrijden.') returning id into p_ver;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'U11',              '#F59E0B', g_ploegen, null, 'Kas van de jeugdploeg U11.') returning id into p_u11;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'U15',              '#0891B2', g_ploegen, null, 'Kas van de jeugdploeg U15.') returning id into p_u15;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Eerste ploeg',     '#1D9E75', g_ploegen, null, 'Kas van de eerste ploeg.') returning id into p_eerste;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Damesploeg',       '#DB2777', g_ploegen, null, 'Kas van de damesploeg.') returning id into p_dames;

  -- transacties (feb t/m jun 2026)
  insert into public.transactions
    (organisation_id, pot_id, amount, direction, occurred_on, memo, counterparty, created_by) values
    -- Kantine
    (v_org, p_kant,   720.00, 'in',  '2026-02-08', 'Kantine thuiswedstrijd',        'Bar',                      v_owner),
    (v_org, p_kant,   845.50, 'in',  '2026-03-15', 'Kantine thuiswedstrijd',        'Bar',                      v_owner),
    (v_org, p_kant,   610.00, 'in',  '2026-04-19', 'Kantine thuiswedstrijd',        'Bar',                      v_owner),
    (v_org, p_kant,   480.00, 'out', '2026-02-12', 'Drankbestelling',               'Drankenhandel Janssens',   v_owner),
    (v_org, p_kant,   510.30, 'out', '2026-04-02', 'Drankbestelling',               'Drankenhandel Janssens',   v_owner),
    -- Uitrusting
    (v_org, p_uit,   1500.00, 'in',  '2026-02-01', 'Hoofdsponsor truitjes',         'Bouwwerken Dhondt',        v_owner),
    (v_org, p_uit,   1320.00, 'out', '2026-02-25', 'Wedstrijdtruitjes en ballen',   'Jartazi',                  v_owner),
    (v_org, p_uit,    165.00, 'out', '2026-05-06', 'Nieuwe netten en hoekvlaggen',  'Decathlon',                v_owner),
    -- Scheidsrechters
    (v_org, p_sch,    300.00, 'in',  '2026-02-01', 'Toelage uit lidgelden',         'Toelage werking',          v_owner),
    (v_org, p_sch,     70.00, 'out', '2026-03-01', 'Scheidsrechtervergoeding',      'KBVB',                     v_owner),
    (v_org, p_sch,     70.00, 'out', '2026-04-12', 'Scheidsrechtervergoeding',      'KBVB',                     v_owner),
    (v_org, p_sch,     25.00, 'out', '2026-03-22', 'Boete laattijdig wedstrijdblad','KBVB',                     v_owner),
    -- Verplaatsingen
    (v_org, p_ver,    500.00, 'in',  '2026-02-01', 'Toelage werking',               'Toelage werking',          v_owner),
    (v_org, p_ver,    280.00, 'out', '2026-03-08', 'Bus uitwedstrijd',              'De Lijn',                  v_owner),
    (v_org, p_ver,    120.00, 'out', '2026-05-10', 'Brandstofvergoeding',           'Vrijwilligers',            v_owner),
    -- U11
    (v_org, p_u11,    540.00, 'in',  '2026-02-10', 'Lidgeld voorjaar (18 spelers)', 'Lidgelden',                v_owner),
    (v_org, p_u11,     96.00, 'out', '2026-04-18', 'Inschrijving paastornooi',      'Tornooiorganisatie',       v_owner),
    -- U15
    (v_org, p_u15,    660.00, 'in',  '2026-02-10', 'Lidgeld voorjaar (22 spelers)', 'Lidgelden',                v_owner),
    (v_org, p_u15,    130.00, 'out', '2026-05-16', 'Trainingsmateriaal',            'Decathlon',                v_owner),
    -- Eerste ploeg
    (v_org, p_eerste, 900.00, 'in',  '2026-02-10', 'Lidgeld voorjaar',              'Lidgelden',                v_owner),
    (v_org, p_eerste, 750.00, 'in',  '2026-03-20', 'Sponsoring reclamebord',        'Garage Verhoeven',         v_owner),
    (v_org, p_eerste, 240.00, 'out', '2026-04-26', 'Tornooi-inschrijving',          'KBVB',                     v_owner),
    (v_org, p_eerste, 320.00, 'out', '2026-05-30', 'Teamuitstap',                   'Bowling',                  v_owner),
    -- Damesploeg
    (v_org, p_dames,  600.00, 'in',  '2026-02-10', 'Lidgeld voorjaar (20 speelsters)','Lidgelden',              v_owner),
    (v_org, p_dames,  145.00, 'out', '2026-04-05', 'Nieuwe ballen en bidons',       'Decathlon',                v_owner);

  raise notice 'Sportclub-demo klaar: % (owner %, 2 groepen, 8 potjes, 25 transacties).', v_org, v_owner;
end $$;
