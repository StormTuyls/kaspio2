-- =============================================================================
-- Demo-account seed: een jeugdbeweging (scouts/VZW) die Kaspio gebruikt
-- =============================================================================
-- Toont hoe een penningmeester de groepsfinanciën in virtuele potjes verdeelt:
-- potgroepen per werking + per tak, met realistische in- en uitgaven.
--
-- VOORAF (eenmalig): maak de demo-login aan, want een login moet een echte
-- auth-user zijn (kan niet betrouwbaar puur in SQL).
--   Supabase dashboard > Authentication > Users > Add user
--     email:    demo@kaspio.be
--     password: kies een wachtwoord, vink "Auto Confirm User" aan
-- Daarna deze hele file in de SQL-editor draaien.
--
-- Idempotent: ruimt eerst de bestaande demo-org op, dus je mag dit opnieuw
-- draaien. Raakt enkel de org met de naam hieronder; je echte data blijft.
--
-- Extra leden (pot-verantwoordelijken per tak) hebben elk een eigen login nodig.
-- Voeg die desgewenst toe via de uitnodigingsflow in de app (Instellingen >
-- Leden uitnodigen); dat is de geteste weg en vult de Leden-tab aan.
-- =============================================================================

do $$
declare
  v_owner uuid;
  v_org   uuid;
  -- potgroepen
  g_werking uuid;
  g_takken  uuid;
  -- potjes
  p_groep uuid; p_kamp uuid; p_mat uuid; p_lok uuid;
  p_kap uuid; p_wou uuid; p_jong uuid; p_giv uuid;
begin
  -- 1. demo-user ophalen
  select id into v_owner from public.profiles where lower(email) = lower('demo@kaspio.be');
  if v_owner is null then
    raise exception
      'Geen profiel voor demo@kaspio.be. Maak die user eerst aan via Authentication > Add user, en draai dan opnieuw.';
  end if;

  -- audit-ruis onderdrukken tijdens het seeden (local: enkel deze transactie)
  perform set_config('kaspio.skip_audit', 'on', true);

  -- een herkenbare naam voor de demo
  update public.profiles set full_name = 'Demo penningmeester' where id = v_owner;

  -- 2. bestaande demo-org opruimen (cascade ruimt potjes, transacties, leden, sub)
  delete from public.organisations
   where owner_id = v_owner and name = 'Scouts Sint-Joris (demo)';

  -- 3. org (trigger voegt de owner automatisch toe als admin)
  insert into public.organisations (name, owner_id)
  values ('Scouts Sint-Joris (demo)', v_owner)
  returning id into v_org;

  -- 4. Team-abonnement (active + comped) zodat potgroepen en onbeperkte
  --    potjes/leden werken. Moet vóór de potjes, anders pakt de gratis limiet.
  insert into public.subscriptions (organisation_id, tier, status, comped)
  values (v_org, 'team', 'active', true)
  on conflict (organisation_id) do update
    set tier = 'team', status = 'active', comped = true;

  -- 5. potgroepen
  insert into public.pot_groups (organisation_id, name, sort_order)
    values (v_org, 'Werking', 0) returning id into g_werking;
  insert into public.pot_groups (organisation_id, name, sort_order)
    values (v_org, 'Takken', 1) returning id into g_takken;

  -- 6. potjes
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Groepskas',          '#1D9E75', g_werking, null,    'Algemene werking, lidgeld en subsidies.') returning id into p_groep;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Kampkas',            '#E8A23D', g_werking, 4000.00, 'Zomerkamp: inschrijvingen, bus, eten, weide.') returning id into p_kamp;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Materiaal',          '#3B82F6', g_werking, null,    'Tenten, sjorhout, spelmateriaal.') returning id into p_mat;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Lokalen & energie',  '#6366F1', g_werking, null,    'Huur, elektriciteit, onderhoud lokaal.') returning id into p_lok;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Kapoenen',           '#EF4444', g_takken,  null,    'Eigen kas van de Kapoenen.') returning id into p_kap;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Wouters',            '#F59E0B', g_takken,  null,    'Eigen kas van de Wouters.') returning id into p_wou;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Jonggivers',         '#10B981', g_takken,  null,    'Eigen kas van de Jonggivers.') returning id into p_jong;
  insert into public.pots (organisation_id, name, color, group_id, target_amount, description) values
    (v_org, 'Givers',             '#0EA5E9', g_takken,  null,    'Eigen kas van de Givers.') returning id into p_giv;

  -- 7. transacties (feb t/m jun 2026), created_by = demo-penningmeester
  insert into public.transactions
    (organisation_id, pot_id, amount, direction, occurred_on, memo, counterparty, created_by) values
    -- Groepskas
    (v_org, p_groep, 1850.00, 'in',  '2026-02-03', 'Lidgeld voorjaar (37 leden)',        'Lidgelden',                     v_owner),
    (v_org, p_groep,  600.00, 'in',  '2026-03-15', 'Gemeentelijke jeugdsubsidie',        'Gemeente Sint-Joris',           v_owner),
    (v_org, p_groep, 1240.50, 'in',  '2026-04-26', 'Opbrengst spaghettiavond',           'Eetfestijn',                    v_owner),
    (v_org, p_groep,  742.00, 'out', '2026-02-10', 'Verzekering leden 2026',             'Scouts en Gidsen Vlaanderen',   v_owner),
    (v_org, p_groep,   96.30, 'out', '2026-03-02', 'Drukwerk infoboekje',                'Copyshop',                      v_owner),
    (v_org, p_groep,  180.00, 'out', '2026-05-18', 'Bivakvergunning en EHBO-kit',        'Scouts en Gidsen Vlaanderen',   v_owner),
    -- Kampkas
    (v_org, p_kamp,  3300.00, 'in',  '2026-04-01', 'Kampinschrijvingen (33 x 100)',      'Ouders',                        v_owner),
    (v_org, p_kamp,   320.00, 'in',  '2026-05-09', 'Opbrengst oud papier',               'Papierophaling',                v_owner),
    (v_org, p_kamp,   540.00, 'out', '2026-05-04', 'Bus naar kampplaats',                'De Lijn',                       v_owner),
    (v_org, p_kamp,  1180.75, 'out', '2026-06-10', 'Kampvoeding groothandel',            'Colruyt',                       v_owner),
    (v_org, p_kamp,   240.00, 'out', '2026-06-15', 'Huur kampweide',                     'Kampplaats De Hoge Rielen',     v_owner),
    -- Materiaal
    (v_org, p_mat,    600.00, 'in',  '2026-02-05', 'Startbudget materiaal',              'Toelage groepskas',             v_owner),
    (v_org, p_mat,    150.00, 'in',  '2026-03-22', 'Verkoop oude tenten',                'Tweedehands',                   v_owner),
    (v_org, p_mat,    220.00, 'out', '2026-02-20', 'Nieuwe sjortouwen',                  'De Banier',                     v_owner),
    (v_org, p_mat,    410.40, 'out', '2026-05-28', 'Reparatie patrouilletent',           'De Banier',                     v_owner),
    -- Lokalen & energie
    (v_org, p_lok,    800.00, 'in',  '2026-02-02', 'Toelage lokalen',                    'Toelage groepskas',             v_owner),
    (v_org, p_lok,    145.00, 'out', '2026-02-01', 'Elektriciteit jan-feb',              'Fluvius',                       v_owner),
    (v_org, p_lok,    145.00, 'out', '2026-04-01', 'Elektriciteit mrt-apr',              'Fluvius',                       v_owner),
    (v_org, p_lok,     89.90, 'out', '2026-03-10', 'Schoonmaakmateriaal lokaal',         'Brico',                         v_owner),
    -- Kapoenen
    (v_org, p_kap,    120.00, 'in',  '2026-02-15', 'Bijdrage takactiviteit',             'Ouders Kapoenen',               v_owner),
    (v_org, p_kap,     64.50, 'out', '2026-03-08', 'Knutselmateriaal',                   'Ava',                           v_owner),
    (v_org, p_kap,     38.20, 'out', '2026-05-10', 'Verkleedspullen bosspel',            'Action',                        v_owner),
    -- Wouters
    (v_org, p_wou,    120.00, 'in',  '2026-02-22', 'Bijdrage daguitstap',                'Ouders Wouters',                v_owner),
    (v_org, p_wou,    110.00, 'out', '2026-04-12', 'Inkom zwembad',                      'Sportoase',                     v_owner),
    -- Jonggivers
    (v_org, p_jong,   160.00, 'in',  '2026-03-29', 'Opbrengst wafelverkoop',             'Wafelverkoop',                  v_owner),
    (v_org, p_jong,    75.60, 'out', '2026-05-24', 'Materiaal hike',                     'Decathlon',                     v_owner),
    -- Givers
    (v_org, p_giv,    200.00, 'in',  '2026-03-01', 'Bijdrage weekend',                   'Ouders Givers',                 v_owner),
    (v_org, p_giv,    132.00, 'out', '2026-04-20', 'Treintickets stadsspel',             'NMBS',                          v_owner),
    (v_org, p_giv,     58.00, 'out', '2026-06-07', 'Kookmateriaal weekend',              'Blokker',                       v_owner);

  raise notice 'Demo-org klaar: % (owner %, 2 groepen, 8 potjes, 29 transacties).', v_org, v_owner;
end $$;

-- Controle (optioneel):
--   select name, balance from public.pot_balances
--   where organisation_id = (select id from organisations where name = 'Scouts Sint-Joris (demo)');
