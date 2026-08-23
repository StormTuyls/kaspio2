-- =============================================================================
-- Kaspio , anon-toegang op lookup_org_invite herstellen
-- =============================================================================
-- Symptoom: wie op een uitnodigingslink klikt zonder ingelogd te zijn, krijgt
-- op het signup-scherm niet te zien voor welke organisatie hij uitgenodigd is,
-- en een verlopen of ongeldige link geeft geen enkele waarschuwing.
--
-- Oorzaak: org-invite-tokens.sql grant deze functie aan `anon, authenticated`,
-- maar in de live database staat anon op false. Ergens is die grant
-- ingetrokken, waarschijnlijk tijdens een eerdere ronde linter-opschoning.
--
--   POST /rest/v1/rpc/lookup_org_invite   (alleen apikey, geen JWT)
--   -> 401 {"code":"42501","message":"permission denied for function ..."}
--
-- App.tsx roept lookupOrgInvite() aan in het publieke gedeelte, dus vóór er
-- een sessie is. Zonder anon-EXECUTE faalt die call altijd.
--
-- Let op wat er NIET stukging: parseInviteParams() zet de token synchroon in
-- localStorage vóór de lookup, dus redeem_org_invite koppelt de nieuwe user
-- nog steeds aan de juiste org. Alleen de bevestiging en de validatie vooraf
-- ontbraken.
--
-- Veiligheid: de functie leest alleen, en enkel op basis van de token zelf.
-- Die token is 'INV-' + 16 hex (~60 bits), dus raden is geen realistische
-- aanval. Anon zonder token krijgt niets te zien.
-- =============================================================================

grant execute on function public.lookup_org_invite(text) to anon;


-- Controle (verwacht: anon = true, authed = true):
--
--   select has_function_privilege('anon', p.oid, 'execute')          as anon,
--          has_function_privilege('authenticated', p.oid, 'execute') as authed
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'lookup_org_invite';
--
-- Daarna te testen zonder in te loggen: open een uitnodigingslink in een
-- privévenster. Het signup-scherm hoort nu de organisatienaam te tonen.
