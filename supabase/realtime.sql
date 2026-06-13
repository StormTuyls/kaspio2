-- =============================================================================
-- Realtime: live sync tussen tabbladen/gebruikers
-- =============================================================================
-- Voegt de kern-tabellen toe aan de supabase_realtime publicatie zodat de
-- frontend postgres_changes-events ontvangt en automatisch refetcht wanneer
-- iemand iets wijzigt. REPLICA IDENTITY FULL is nodig zodat DELETE-events ook
-- de organisation_id meedragen (anders matcht de org-filter niet op deletes).
-- Idempotent: veilig om opnieuw te draaien.
-- =============================================================================

do $$
declare
  t text;
  tables text[] := array[
    'pots', 'transactions', 'pot_groups', 'memberships', 'org_invites', 'audit_log'
  ];
begin
  foreach t in array tables loop
    -- Voeg toe aan de publicatie als 'ie er nog niet in zit
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    -- Volledige row in change-events (nodig voor DELETE-filtering op org)
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

-- Verificatie:
--   select tablename from pg_publication_tables where pubname='supabase_realtime';
