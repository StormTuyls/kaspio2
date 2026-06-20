-- =============================================================================
-- Digest-cron , roept send-digest periodiek aan (dagelijks + wekelijks)
-- =============================================================================
-- Vereist de extensies pg_cron en pg_net (Database -> Extensions, of hieronder).
-- Vervang <DIGEST_SECRET> door dezelfde waarde als de DIGEST_SECRET-secret van
-- de Edge Function, en <ANON_KEY> door je publishable/anon key.
--
-- Deploy de functie eerst met JWT-verificatie UIT:
--   supabase functions deploy send-digest --no-verify-jwt
-- en zet de secret:
--   supabase secrets set DIGEST_SECRET=<iets-willekeurigs>
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Oude jobs opruimen (idempotent).
select cron.unschedule('kaspio-digest-daily')  where exists (select 1 from cron.job where jobname = 'kaspio-digest-daily');
select cron.unschedule('kaspio-digest-weekly') where exists (select 1 from cron.job where jobname = 'kaspio-digest-weekly');

-- Dagelijks om 07:00 UTC.
select cron.schedule(
  'kaspio-digest-daily',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://dxwyciqpryyoeuhukung.supabase.co/functions/v1/send-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-digest-secret', '<DIGEST_SECRET>'
    ),
    body := jsonb_build_object('period', 'daily')
  );
  $$
);

-- Wekelijks op maandag om 07:00 UTC.
select cron.schedule(
  'kaspio-digest-weekly',
  '0 7 * * 1',
  $$
  select net.http_post(
    url := 'https://dxwyciqpryyoeuhukung.supabase.co/functions/v1/send-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-digest-secret', '<DIGEST_SECRET>'
    ),
    body := jsonb_build_object('period', 'weekly')
  );
  $$
);

-- Verificatie:
--   select jobname, schedule from cron.job where jobname like 'kaspio-digest%';
