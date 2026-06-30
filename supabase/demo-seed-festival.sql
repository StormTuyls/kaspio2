-- =============================================================================
-- Demo-account: derde org voor een andere doelgroep (evenement-VZW)
-- =============================================================================
-- Voegt een DERDE organisatie toe aan dezelfde demo-login (demo@kaspio.be): een
-- VZW die een buurtfestival organiseert. Toont potgroepen op hun best: elke
-- werkgroep is een groep, met eigen potjes en geldstromen. Andere doelgroep dan
-- de scouts en de sportclub.
--
-- VOORAF: dezelfde demo-user moet bestaan (zie demo-seed.sql). Raakt de andere
-- demo-orgs NIET. Idempotent. Draai in de Supabase SQL-editor.
-- =============================================================================

do $$
declare
  v_owner uuid;
  v_org   uuid;
  g_alg uuid; g_prog uuid; g_bar uuid; g_log uuid; g_com uuid;
  p_werk uuid; p_subs uuid;
  p_art uuid; p_pod uuid;
  p_drank uuid; p_food uuid;
  p_mat uuid; p_veil uuid;
  p_promo uuid;
begin
  select id into v_owner from public.profiles where lower(email) = lower('demo@kaspio.be');
  if v_owner is null then
    raise exception
      'Geen profiel voor demo@kaspio.be. Maak die user eerst aan (Authentication > Add user) en draai demo-seed.sql.';
  end if;

  perform set_config('kaspio.skip_audit', 'on', true);

  delete from public.organisations
   where owner_id = v_owner and name = 'Buurtfestival De Kade (demo)';

  insert into public.organisations (name, owner_id)
  values ('Buurtfestival De Kade (demo)', v_owner)
  returning id into v_org;

  insert into public.subscriptions (organisation_id, tier, status, comped)
  values (v_org, 'team', 'active', true)
  on conflict (organisation_id) do update
    set tier = 'team', status = 'active', comped = true;

  -- potgroepen = werkgroepen
  insert into public.pot_groups (organisation_id, name, sort_order) values (v_org, 'Algemeen',          0) returning id into g_alg;
  insert into public.pot_groups (organisation_id, name, sort_order) values (v_org, 'Programmatie',      1) returning id into g_prog;
  insert into public.pot_groups (organisation_id, name, sort_order) values (v_org, 'Bar & catering',    2) returning id into g_bar;
  insert into public.pot_groups (organisation_id, name, sort_order) values (v_org, 'Logistiek',         3) returning id into g_log;
  insert into public.pot_groups (organisation_id, name, sort_order) values (v_org, 'Communicatie',      4) returning id into g_com;

  -- potjes
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Werkingskas',           '#1D9E75', g_alg,  null, 'Subsidies, verzekering, vergunningen.') returning id into p_werk;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Subsidies & sponsoring','#F59E0B', g_alg,  null, 'Binnenkomende sponsoring en subsidies.') returning id into p_subs;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Artiesten & gages',     '#7C3AED', g_prog, null, 'Boekingen en gages van de acts.') returning id into p_art;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Podium, licht & geluid','#2563EB', g_prog, null, 'Podiumhuur en technische productie.') returning id into p_pod;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Drank',                 '#16A34A', g_bar,  null, 'Baromzet en drankaankopen.') returning id into p_drank;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Foodtrucks',            '#DB2777', g_bar,  null, 'Standgeld en stroom foodzone.') returning id into p_food;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Materiaal & tenten',    '#0891B2', g_log,  null, 'Tenten, nadar, tafels en banken.') returning id into p_mat;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Veiligheid & EHBO',     '#DC2626', g_log,  null, 'EHBO-post, brandblussers, signalisatie.') returning id into p_veil;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Promo & drukwerk',      '#EA580C', g_com,  null, 'Affiches, flyers en online promo.') returning id into p_promo;

  -- transacties (feb t/m jun 2026, festival in juni)
  insert into public.transactions
    (organisation_id, pot_id, amount, direction, occurred_on, memo, counterparty, created_by) values
    -- Werkingskas
    (v_org, p_werk,  1000.00, 'in',  '2026-02-15', 'Gemeentelijke projectsubsidie',  'Gemeente',                  v_owner),
    (v_org, p_werk,   380.00, 'out', '2026-03-01', 'Evenementenverzekering',          'Verzekeraar',               v_owner),
    (v_org, p_werk,   120.00, 'out', '2026-02-20', 'Vergunning en SABAM-aangifte',    'Gemeente',                  v_owner),
    -- Subsidies & sponsoring
    (v_org, p_subs,   500.00, 'in',  '2026-03-10', 'Sponsoring',                      'Bakkerij ''t Molentje',     v_owner),
    (v_org, p_subs,   750.00, 'in',  '2026-03-18', 'Sponsoring',                      'Garage Verhoeven',          v_owner),
    (v_org, p_subs,   300.00, 'in',  '2026-04-05', 'Sponsoring',                      'Apotheek Centrum',          v_owner),
    -- Artiesten & gages
    (v_org, p_art,   2000.00, 'in',  '2026-05-01', 'Budget boekingen (uit werking)',  'Interne toelage',           v_owner),
    (v_org, p_art,    850.00, 'out', '2026-05-20', 'Gage hoofdact',                   'Boekingskantoor Nova',      v_owner),
    (v_org, p_art,    450.00, 'out', '2026-05-22', 'Gage support-act',                'Local Heroes',              v_owner),
    (v_org, p_art,    300.00, 'out', '2026-06-01', 'Gage DJ',                         'DJ Lumen',                  v_owner),
    -- Podium, licht & geluid
    (v_org, p_pod,   1400.00, 'in',  '2026-04-20', 'Budget techniek (uit werking)',   'Interne toelage',           v_owner),
    (v_org, p_pod,    780.00, 'out', '2026-05-25', 'Podiumhuur',                      'EventRent',                 v_owner),
    (v_org, p_pod,    540.00, 'out', '2026-05-28', 'Licht en geluid',                 'SoundCrew',                 v_owner),
    -- Drank
    (v_org, p_drank, 2450.00, 'in',  '2026-06-21', 'Baromzet festivaldag',            'Bar',                       v_owner),
    (v_org, p_drank, 1320.00, 'out', '2026-06-05', 'Drankbestelling',                 'Drankenhandel Janssens',    v_owner),
    (v_org, p_drank,  180.00, 'out', '2026-06-10', 'Huur tapinstallatie',             'Drankenhandel Janssens',    v_owner),
    -- Foodtrucks
    (v_org, p_food,   600.00, 'in',  '2026-06-21', 'Standgeld foodtrucks',            'Foodtrucks',                v_owner),
    (v_org, p_food,    75.00, 'out', '2026-06-02', 'Stroomvoorziening foodzone',      'EventRent',                 v_owner),
    -- Materiaal & tenten
    (v_org, p_mat,    900.00, 'in',  '2026-04-10', 'Budget logistiek (uit werking)',  'Interne toelage',           v_owner),
    (v_org, p_mat,    620.00, 'out', '2026-05-30', 'Huur tenten en nadarhekken',      'EventRent',                 v_owner),
    (v_org, p_mat,    210.00, 'out', '2026-06-12', 'Tafels, banken, koelwagen',       'Verhuur Peeters',           v_owner),
    -- Veiligheid & EHBO
    (v_org, p_veil,   400.00, 'in',  '2026-05-05', 'Budget veiligheid (uit werking)', 'Interne toelage',           v_owner),
    (v_org, p_veil,   250.00, 'out', '2026-06-15', 'EHBO-post',                       'Rode Kruis Vlaanderen',     v_owner),
    (v_org, p_veil,   140.00, 'out', '2026-06-18', 'Brandblussers en signalisatie',   'Veiligheidshuis',           v_owner),
    -- Promo & drukwerk
    (v_org, p_promo,  350.00, 'in',  '2026-03-25', 'Budget communicatie (uit werking)','Interne toelage',          v_owner),
    (v_org, p_promo,  240.00, 'out', '2026-04-15', 'Affiches en flyers',              'Drukkerij Devos',           v_owner),
    (v_org, p_promo,   90.00, 'out', '2026-05-12', 'Online promo',                    'Meta',                      v_owner);

  raise notice 'Festival-demo klaar: % (owner %, 5 groepen, 9 potjes, 27 transacties).', v_org, v_owner;
end $$;
