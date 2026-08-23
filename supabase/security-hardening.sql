-- =============================================================================
-- Kaspio , security hardening naar aanleiding van de database linter
-- Run dit NA alle andere bestanden. Idempotent: opnieuw draaien mag.
-- =============================================================================
-- Achtergrond: Postgres geeft bij CREATE FUNCTION standaard EXECUTE aan PUBLIC.
-- In dit schema staat maar één expliciete revoke (book_due_reservations), dus
-- elke andere functie is bereikbaar via /rest/v1/rpc/<naam>, ook de functies
-- die enkel bedoeld waren voor intern gebruik of voor de SQL Editor.
--
-- Wat dit bestand doet:
--   1. create_invite krijgt een platform-admin-check en gaat dicht  <- de echte
--      kwetsbaarheid: elke ingelogde gebruiker kon zelf beta-codes aanmaken.
--   2. consume_invite en org_tier gaan dicht (niemand roept ze nog aan vanaf
--      de client; org_tier wordt enkel binnen andere definer-functies gebruikt).
--   3. search_path wordt vastgezet op de zes definer-functies die hem misten.
--
-- Wat dit bestand bewust NIET doet: de policy-helpers (is_org_member,
-- is_org_admin, can_view_pot, can_write_pot) blijven staan zoals ze zijn. Zie
-- de toelichting onderaan.
-- =============================================================================


-- =============================================================================
-- 1. CREATE_INVITE , autorisatie toevoegen en dichtzetten
-- =============================================================================
-- Deze functie mintte beta-codes zonder enige check op wie ze aanriep. De
-- bedoeling was "alleen ik, vanuit de SQL Editor" (zie de oude comment in
-- invite-codes.sql), maar door de default PUBLIC-grant kon elke ingelogde
-- gebruiker /rest/v1/rpc/create_invite aanroepen en onbeperkt codes genereren.
--
-- Twee sloten, want één is er één te weinig:
--   - een is_platform_admin()-check in de functie zelf
--   - EXECUTE weg bij public/anon/authenticated
-- De SQL Editor draait als postgres en blijft dus gewoon werken.

create or replace function public.create_invite(
  p_email text default null,
  p_note text default null,
  p_max_uses int default 1,
  p_expires_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  -- current_user = postgres wanneer dit vanuit de SQL Editor of een migratie
  -- draait; dan is er geen auth.uid() en hoeft de admin-check niet.
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'Alleen de app-eigenaar kan invite-codes maken'
      using errcode = '42501';
  end if;

  v_code := 'KASP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.invite_codes (code, email, note, max_uses, expires_at, created_by)
  values (v_code, p_email, p_note, p_max_uses, p_expires_at, auth.uid());

  return v_code;
end;
$$;

revoke all on function public.create_invite(text, text, int, timestamptz)
  from public, anon, authenticated;


-- =============================================================================
-- 2. CONSUME_INVITE , dichtzetten
-- =============================================================================
-- De closed-beta-gate is vervangen door de org-invite-tokens (org-invite-tokens.sql).
-- Niets in src/ roept consume_invite nog aan. Zolang hij openstond kon anon
-- de codetabel brute-forcen: 'KASP-' + 6 hex = 24 bits, en elke poging hoogt
-- `uses` op, dus je kon andermans codes ook opbranden.
--
-- Zet je de closed beta weer aan, geef de codes dan eerst meer entropie
-- (16 hex i.p.v. 6, zoals de org-invite-tokens) voor je dit terugdraait.

revoke all on function public.consume_invite(text, text) from public, anon, authenticated;


-- =============================================================================
-- 3. ORG_TIER , dichtzetten
-- =============================================================================
-- Wordt uitsluitend aangeroepen vanuit andere SECURITY DEFINER-functies en
-- trigger-functies (free-tier-limits, groups-tier-gate, attachments,
-- approval-flows, subscriptions, org-invite-tokens). Die draaien als owner en
-- houden dus EXECUTE, ongeacht wat de client mag. Geen enkele policy en geen
-- enkele client-call gebruikt hem, dus hij hoeft niet in de REST-API te staan.

revoke all on function public.org_tier(uuid) from public, anon, authenticated;


-- =============================================================================
-- 4. SEARCH_PATH VASTZETTEN
-- =============================================================================
-- Een SECURITY DEFINER-functie zonder vaste search_path draait met de
-- search_path van de aanroeper. Wie objecten kan aanmaken in een schema dat
-- eerder in dat pad staat, kan de functie zo laten verwijzen naar zijn eigen
-- tabel of operator. Vier van de zes hieronder zijn de functies die bepalen
-- wie wat mag zien, dus die wil je zeker vastgepind hebben.
--
-- ALTER FUNCTION i.p.v. CREATE OR REPLACE: zo hoeven we de bodies niet te
-- kopiëren en kan er niets uit de pas lopen met de originele definities.

alter function public.is_org_member(uuid)      set search_path = public;
alter function public.is_org_admin(uuid)       set search_path = public;
alter function public.can_view_pot(uuid)       set search_path = public;
alter function public.can_write_pot(uuid)      set search_path = public;
alter function public.add_owner_as_admin()     set search_path = public;
alter function public.log_audit()              set search_path = public;


-- =============================================================================
-- CONTROLE
-- =============================================================================
-- Na het draaien: geen enkele rij mag hier nog terugkomen.
--
--   select p.proname, p.proconfig
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.prosecdef
--     and (p.proconfig is null or not p.proconfig::text like '%search_path%');
--
-- En om te zien wie welke functie nog mag aanroepen:
--
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'execute')          as anon,
--          has_function_privilege('authenticated', p.oid, 'execute') as authed
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef
--   order by 1;


-- =============================================================================
-- WAAROM DE POLICY-HELPERS BLIJVEN STAAN
-- =============================================================================
-- De linter vlagt ook is_org_member, is_org_admin, can_view_pot en
-- can_write_pot. Die kunnen we hier niet zomaar dichtzetten:
--
--   Een RLS-policy-expressie wordt geëvalueerd met de rechten van de rol die
--   de query doet, niet met die van de tabeleigenaar. Zodra je EXECUTE afneemt
--   van `authenticated`, faalt elke SELECT op pots/transactions/memberships met
--   "permission denied for function". Dat zijn 46 policy-verwijzingen.
--
-- De schone oplossing is ze naar een schema te verhuizen dat PostgREST niet
-- exposeert (bv. `private`) en alle policies mee te verbouwen. Dat is een
-- aparte, goed te testen migratie waard, geen bijzaak van dit bestand.
--
-- De winst is bovendien klein: alle vier antwoorden ze uitsluitend over
-- auth.uid(), dus de aanroeper leert er niets mee dat hij niet al weet. Het
-- enige dat lekt is "bestaat org X en ben ik er lid van" voor een gegokte
-- UUID, en dat is geen realistische aanval.
