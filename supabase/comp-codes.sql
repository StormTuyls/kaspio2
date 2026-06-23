-- =============================================================================
-- Comp-codes , gratis Pro/Team voor testdoeleinden
-- =============================================================================
-- De app-eigenaar (platform-admin) maakt een code/link. Wie de link opent en
-- redeemt, tilt zijn org gratis naar Pro (of Team), zonder Stripe. Bedoeld voor
-- testers/demo's. Gewone org-admins kunnen GEEN codes maken (anders geeft
-- iedereen zichzelf Pro); enkel platform-admins.
--
-- Link: https://kaspio.be/?comp=<code>
-- =============================================================================

-- Markeer comped subscriptions (zodat ze van echte Stripe-subs te onderscheiden zijn).
alter table public.subscriptions
  add column if not exists comped boolean not null default false;

-- 1. Platform-admins (de app-eigenaar). Seed jezelf hieronder.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- Geen policies: enkel SECURITY DEFINER-functies (en de service role) lezen dit.

create or replace function public.is_platform_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
grant execute on function public.is_platform_admin() to authenticated;

-- 2. Comp-codes
create table if not exists public.comp_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  tier public.sub_tier not null default 'pro',
  note text,
  max_redemptions int not null default 1,
  redeemed_count int not null default 0,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.comp_codes enable row level security;
-- Geen directe client-toegang; alles via de RPC's hieronder.

-- 3. Code aanmaken (enkel platform-admin)
create or replace function public.create_comp_code(
  p_tier public.sub_tier default 'pro',
  p_max int default 1,
  p_note text default null,
  p_expires_at timestamptz default null
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if not public.is_platform_admin() then
    raise exception 'Alleen de app-eigenaar kan testcodes maken';
  end if;
  if p_tier not in ('pro', 'team') then
    raise exception 'Tier moet pro of team zijn';
  end if;

  v_code := upper(p_tier::text) || '-' ||
            upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.comp_codes (code, tier, note, max_redemptions, expires_at, created_by)
  values (v_code, p_tier, p_note, greatest(p_max, 1), p_expires_at, auth.uid());

  return v_code;
end; $$;
grant execute on function public.create_comp_code(public.sub_tier, int, text, timestamptz)
  to authenticated;

-- 4. Code inwisselen voor een org (caller moet admin van die org zijn)
-- Returnt jsonb: { status, tier? }
--   status: 'ok' | 'not_authenticated' | 'not_admin' | 'not_found'
--         | 'expired' | 'used_up'
create or replace function public.redeem_comp_code(p_code text, p_org_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_cc record;
begin
  if v_user is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;
  if not public.is_org_admin(p_org_id) then
    return jsonb_build_object('status', 'not_admin');
  end if;

  select * into v_cc from public.comp_codes where code = upper(trim(p_code));
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_cc.expires_at is not null and v_cc.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_cc.redeemed_count >= v_cc.max_redemptions then
    return jsonb_build_object('status', 'used_up');
  end if;

  -- Til de org naar het comp-tier. Defensieve upsert: meestal bestaat de rij al.
  insert into public.subscriptions (organisation_id, tier, status, comped, current_period_end)
  values (p_org_id, v_cc.tier, 'active', true, v_cc.expires_at)
  on conflict (organisation_id) do update
    set tier = excluded.tier,
        status = 'active',
        comped = true,
        current_period_end = excluded.current_period_end,
        updated_at = now();

  update public.comp_codes set redeemed_count = redeemed_count + 1 where id = v_cc.id;

  return jsonb_build_object('status', 'ok', 'tier', v_cc.tier);
end; $$;
grant execute on function public.redeem_comp_code(text, uuid) to authenticated;

-- =============================================================================
-- SEED: maak jezelf platform-admin (stormtuyls@icloud.com).
-- user_id uit de auth.users / network-logs: 8ce38e95-6a4f-4d5c-a659-8ef96fb3c023
-- =============================================================================
insert into public.platform_admins (user_id)
values ('8ce38e95-6a4f-4d5c-a659-8ef96fb3c023')
on conflict (user_id) do nothing;

-- Verificatie:
--   select public.create_comp_code('pro', 5, 'beta-testers');  -- als platform-admin
