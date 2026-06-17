-- =============================================================================
-- RESET , wis alle app-DATA, behoud het schema en de accounts
-- =============================================================================
-- ONOMKEERBAAR. Draai dit enkel bewust in de Supabase SQL Editor.
--
-- Wat dit doet:
--   - Verwijdert ALLE organisaties. Door de `on delete cascade` gaan mee:
--     pots, memberships, transactions, audit_log, org_invites, pot_groups,
--     subscriptions.
--   - Wist notification_settings (per-user, niet via cascade) en de oude
--     beta invite_codes.
--
-- Wat BLIJFT bestaan:
--   - Je accounts in auth.users (je blijft ingelogd) en hun public.profiles.
--   - Het volledige schema, functies, triggers en RLS-policies.
--
-- Na deze reset: log in en maak een verse organisatie aan.
-- =============================================================================

begin;

delete from public.organisations;        -- cascade ruimt alle org-data op
delete from public.notification_settings; -- per-user, niet via cascade
delete from public.invite_codes;          -- ongebruikte beta-codes

commit;

-- =============================================================================
-- OPTIONEEL , ook de accounts zelf wissen (helemaal blanco)
-- =============================================================================
-- Dit kan NIET via deze SQL (auth.users zit in het beveiligde auth-schema).
-- Doe dat via het Supabase dashboard: Authentication -> Users -> selecteer ->
-- Delete. Verwijder dan eventueel ook de bijhorende rij in public.profiles:
--   delete from public.profiles where id = '<user-uuid>';
-- =============================================================================

-- Verificatie:
--   select count(*) from public.organisations;  -- moet 0 zijn
--   select count(*) from public.pots;            -- moet 0 zijn
