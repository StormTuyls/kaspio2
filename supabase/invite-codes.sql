-- =============================================================================
-- Kaspio , invite codes voor gesloten beta
-- Run dit ALS aanvulling op supabase/schema.sql, niet ter vervanging.
-- =============================================================================

-- =============================================================================
-- 1. INVITE_CODES TABEL
-- =============================================================================

create table public.invite_codes (
  code text primary key,
  -- Optioneel beperkt tot specifiek e-mail (null = werkt voor elke email)
  email text,
  -- Hoeveel keer kan deze code gebruikt worden (default: éénmalig)
  max_uses int not null default 1 check (max_uses > 0),
  uses int not null default 0,
  -- Optionele vervaldatum
  expires_at timestamptz,
  -- Notitie voor jezelf (bv. naam van de waitlist-persoon, voor wie deze code is)
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index invite_codes_email_idx on public.invite_codes(lower(email))
  where email is not null;

-- =============================================================================
-- 2. RLS , tabel is volledig dicht voor clients
-- =============================================================================
-- Alleen via de security-definer RPC `consume_invite` kunnen clients
-- met codes interageren. Niemand kan de tabel direct lezen.

alter table public.invite_codes enable row level security;
-- Geen policies = geen toegang via PostgREST.

-- =============================================================================
-- 3. CONSUME_INVITE RPC
-- =============================================================================
-- Atomic: valideer + consume in één keer. Voorkomt race-condities.
-- Returns:
--   'ok'           , code is geldig, uses is opgehoogd, signup mag door
--   'not_found'    , code bestaat niet
--   'expired'      , code is verlopen
--   'exhausted'    , code is al max-aantal keer gebruikt
--   'email_mismatch' , code is gebonden aan ander e-mail dan opgegeven

create or replace function public.consume_invite(p_code text, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.invite_codes%rowtype;
begin
  -- Lock de rij om race-conditions te voorkomen
  select * into v_row
  from public.invite_codes
  where code = p_code
  for update;

  if not found then
    return 'not_found';
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    return 'expired';
  end if;

  if v_row.uses >= v_row.max_uses then
    return 'exhausted';
  end if;

  if v_row.email is not null
     and lower(v_row.email) != lower(p_email) then
    return 'email_mismatch';
  end if;

  update public.invite_codes
  set uses = uses + 1
  where code = p_code;

  return 'ok';
end;
$$;

grant execute on function public.consume_invite(text, text) to anon, authenticated;

-- =============================================================================
-- 4. HELPER , genereer een random invite code
-- =============================================================================
-- Run als admin in SQL Editor om een code aan te maken.
-- Voorbeeld:
--   select public.create_invite('storm@kaspio.be', 'Test eigen account');
--   , geeft je iets als 'KASP-7F3A2B' terug

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
  -- KASP-XXXXXX waar XXXXXX 6 random uppercase hex-tekens zijn.
  -- gen_random_uuid() is built-in (Postgres 13+) en vereist geen extensions schema.
  v_code := 'KASP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.invite_codes (code, email, note, max_uses, expires_at, created_by)
  values (v_code, p_email, p_note, p_max_uses, p_expires_at, auth.uid());

  return v_code;
end;
$$;

-- Niet exposen aan anon , alleen authenticated admins
-- (Voor nu: jij run dit via SQL Editor wat geen RLS toepast)

-- =============================================================================
-- DONE
-- =============================================================================
-- Verificatie:
--   select count(*) from public.invite_codes; , moet 0 zijn (lege tabel)
--   select public.consume_invite('NIET-BESTAAND', 'a@b.com'); , 'not_found'
