-- =============================================================================
-- Supabase-omgeving nabootsen op een kale Postgres
-- =============================================================================
-- Alleen nodig voor de lokale variant (scripts/testdb/testdb.sh local). Draai je
-- tegen de Supabase CLI, dan bestaat dit allemaal al en wordt dit bestand
-- overgeslagen.
--
-- De app-SQL leunt op vier dingen die Supabase meebrengt: de rollen anon,
-- authenticated en service_role, het auth-schema met auth.users, auth.uid() dat
-- de huidige gebruiker uit de JWT-claims leest, en pgcrypto voor gen_random_uuid.
-- =============================================================================

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create schema if not exists auth;

-- Minimale auth.users. Alleen de kolommen waar de app-SQL naar verwijst.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Zelfde contract als bij Supabase: lees de gebruiker uit de request-claims.
-- Zonder claims (SQL Editor, migratie, cron) geeft dit null terug.
-- nullif op de setting zelf, niet op het resultaat: bij uitgelogd staat de
-- setting op een lege string en die is geen geldige JSON.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), ''
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'anon'
  )
$$;

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
grant select on auth.users to service_role;

-- Handig bij het testen: doe alsof je als deze gebruiker ingelogd bent.
--   select public.login_as('<uuid>');  ->  auth.uid() geeft die uuid terug
--   select public.login_as(null);      ->  terug naar uitgelogd
create or replace function public.login_as(p_user uuid) returns void
language plpgsql as $$
begin
  if p_user is null then
    perform set_config('request.jwt.claims', '', false);
  else
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
      false);
  end if;
end $$;

-- Realtime-publicatie. Verschillende bestanden doen
-- `alter publication supabase_realtime add table ...`, en die publicatie maakt
-- Supabase zelf aan.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- pg_cron is niet beschikbaar op een Homebrew-Postgres, maar de app-SQL roept
-- cron.schedule aan om de nachtelijke reserveringen te plannen. We zetten een
-- lege cron-schil neer zodat die bestanden gewoon laden. Er wordt lokaal dus
-- niets ingepland; de functies die de cron aanroept (book_due_reservations)
-- bestaan wel en kan je met de hand testen.
create schema if not exists cron;

create table if not exists cron.job (
  jobid bigserial primary key,
  jobname text unique,
  schedule text,
  command text,
  active boolean not null default true
);

create or replace function cron.schedule(p_name text, p_schedule text, p_command text)
returns bigint language plpgsql as $$
declare v_id bigint;
begin
  insert into cron.job (jobname, schedule, command)
  values (p_name, p_schedule, p_command)
  on conflict (jobname) do update
    set schedule = excluded.schedule, command = excluded.command
  returning jobid into v_id;
  return v_id;
end $$;

create or replace function cron.unschedule(p_name text)
returns boolean language plpgsql as $$
begin
  delete from cron.job where jobname = p_name;
  return true;
end $$;

-- Supabase Storage. attachments.sql maakt een bucket aan en hangt policies op
-- storage.objects. Alleen de vorm is nodig, niet de echte opslaglaag.
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

-- Supabase splitst een objectnaam "org-uuid/bestand.pdf" in mappen. De policies
-- in attachments.sql leunen daarop.
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(regexp_replace(name, '/[^/]*$', ''), '/')
$$;

grant usage on schema storage to anon, authenticated, service_role;

-- Standaardrechten zoals op de echte Supabase-instantie. Belangrijk detail: op
-- productie staat `anon` op false voor de functies in public, terwijl Postgres
-- bij CREATE FUNCTION standaard EXECUTE aan PUBLIC geeft. Dat verschil komt
-- hiervandaan, en zonder deze regel test je lokaal ruimere rechten dan je echt
-- hebt.
alter default privileges in schema public revoke execute on functions from public;
