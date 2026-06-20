-- =============================================================================
-- Goedkeuringsflows (Team-feature)
-- =============================================================================
-- Een potbeheerder die een UITGAVE boekt boven de ingestelde drempel, komt in
-- status 'pending'. Admins boeken meteen 'approved'. Pending telt NIET mee in
-- het saldo (frontend rekent client-side en filtert op status). Opt-in per org.
-- =============================================================================

-- 1. status op transactions
alter table public.transactions
  add column if not exists status text not null default 'approved';
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_status_check'
  ) then
    alter table public.transactions
      add constraint transactions_status_check check (status in ('approved', 'pending'));
  end if;
end $$;

-- 2. org-instellingen (opt-in + drempel)
alter table public.organisations
  add column if not exists require_approval boolean not null default false;
alter table public.organisations
  add column if not exists approval_threshold numeric not null default 0;

-- 3. Trigger: bepaal de status bij insert (server-side, niet te omzeilen).
create or replace function public.set_transaction_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_require boolean;
  v_threshold numeric;
  v_is_admin boolean;
  v_is_pot_owner boolean;
begin
  new.status := 'approved';  -- standaard

  select require_approval, approval_threshold
    into v_require, v_threshold
  from public.organisations where id = new.organisation_id;

  if coalesce(v_require, false)
     and public.org_tier(new.organisation_id) = 'team'
     and new.direction = 'out'
     and new.amount >= coalesce(v_threshold, 0) then
    select
      exists(select 1 from public.memberships
             where organisation_id = new.organisation_id
               and user_id = auth.uid() and role = 'admin'),
      exists(select 1 from public.memberships
             where organisation_id = new.organisation_id
               and user_id = auth.uid() and role = 'pot_owner')
      into v_is_admin, v_is_pot_owner;
    -- Enkel potbeheerders die geen admin zijn, moeten langs goedkeuring.
    if v_is_pot_owner and not v_is_admin then
      new.status := 'pending';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists set_transaction_status_trigger on public.transactions;
create trigger set_transaction_status_trigger
  before insert on public.transactions
  for each row execute function public.set_transaction_status();

-- 4. Goedkeuren / afwijzen (admin-only)
create or replace function public.approve_transaction(p_txn_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organisation_id into v_org from public.transactions where id = p_txn_id;
  if v_org is null then raise exception 'Transactie bestaat niet' using errcode = '42704'; end if;
  if not public.is_org_admin(v_org) then
    raise exception 'Alleen een beheerder kan goedkeuren' using errcode = '42501';
  end if;
  update public.transactions set status = 'approved' where id = p_txn_id;
end; $$;
grant execute on function public.approve_transaction(uuid) to authenticated;

-- Afwijzen = de transactie verwijderen (alsof ze nooit gebeurd is).
create or replace function public.reject_transaction(p_txn_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organisation_id into v_org from public.transactions where id = p_txn_id;
  if v_org is null then raise exception 'Transactie bestaat niet' using errcode = '42704'; end if;
  if not public.is_org_admin(v_org) then
    raise exception 'Alleen een beheerder kan afwijzen' using errcode = '42501';
  end if;
  delete from public.transactions where id = p_txn_id;
end; $$;
grant execute on function public.reject_transaction(uuid) to authenticated;

-- 5. Org-instelling zetten (admin-only): aan/uit + drempel.
create or replace function public.set_approval_settings(
  p_org uuid,
  p_require boolean,
  p_threshold numeric
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_org_admin(p_org) then
    raise exception 'Alleen een beheerder kan dit wijzigen' using errcode = '42501';
  end if;
  update public.organisations
    set require_approval = coalesce(p_require, false),
        approval_threshold = greatest(0, coalesce(p_threshold, 0))
  where id = p_org;
end; $$;
grant execute on function public.set_approval_settings(uuid, boolean, numeric) to authenticated;

-- Let op: de pot_balances-view (indien je die elders gebruikt) telt nog alle
-- transacties; de frontend rekent client-side en filtert op status. Wil je de
-- view ook correct, voeg dan `where status = 'approved'` toe aan de definitie.
