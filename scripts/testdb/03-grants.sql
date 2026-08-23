-- =============================================================================
-- Tabelrechten, na het laden van het schema
-- =============================================================================
-- Supabase geeft anon en authenticated rechten op de tabellen in public; RLS
-- doet daarna het filteren. Zonder deze grants krijg je "permission denied" en
-- bereik je de policies nooit, dus dan test je RLS helemaal niet.
-- =============================================================================

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;
grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

-- service_role hoort overal langs te kunnen, ook langs RLS.
grant all on all tables in schema public to service_role;
