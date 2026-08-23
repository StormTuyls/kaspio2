-- =============================================================================
-- Kaspio , hoofdpot als echt potje + allocaties
-- =============================================================================
-- Ontwerp: docs/superpowers/specs/2026-08-23-hoofdpot-allocaties-design.md
--
-- LET OP: dit hoort samen met de bijhorende app-wijziging uitgerold te worden,
-- niet los. De CHECK onderaan verbiedt dat de som van de allocaties boven het
-- transactiebedrag komt, en de huidige app verlaagt bij splitsen nog `amount`
-- op de originele rij. Zet je dit alleen aan, dan breekt splitsen in de app.
--
-- Wat hier wél veilig is: de bestaande `pot_id` blijft ongemoeid. De app blijft
-- dus gewoon lezen wat ze altijd las; de nieuwe structuur staat ernaast en
-- bevat exact dezelfde waarheid.
--
-- Wat dit doet:
--   1. hoofdpot als echt potje per organisatie
--   2. transactions krijgt allocated_amount, voided_at, voided_by
--   3. allocations-tabel met RLS
--   4. trigger die allocated_amount bijhoudt, plus de CHECK die de grens bewaakt
--   5. bestaande toewijzingen omzetten naar allocaties
--   6. potjeslimiet, zichtbaarheid en pot_balances aanpassen
-- =============================================================================


-- =============================================================================
-- 1. HOOFDPOT ALS ECHT POTJE
-- =============================================================================

alter table public.pots
  add column if not exists is_hoofdpot boolean not null default false;

-- Hoogstens één hoofdpot per organisatie.
create unique index if not exists pots_one_hoofdpot_per_org
  on public.pots(organisation_id) where is_hoofdpot;

-- Elke bestaande org krijgt er een. Idempotent dankzij de index hierboven.
insert into public.pots (organisation_id, name, color, description, is_hoofdpot)
select o.id, 'Hoofdpot', '#64748b',
       'Geld dat nog geen specifiek potje heeft.', true
from public.organisations o
where not exists (
  select 1 from public.pots p
   where p.organisation_id = o.id and p.is_hoofdpot
);

-- Nieuwe orgs krijgen er automatisch een.
create or replace function public.add_hoofdpot()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.pots (organisation_id, name, color, description, is_hoofdpot)
  values (new.id, 'Hoofdpot', '#64748b',
          'Geld dat nog geen specifiek potje heeft.', true)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_org_created_hoofdpot on public.organisations;
create trigger on_org_created_hoofdpot
  after insert on public.organisations
  for each row execute function public.add_hoofdpot();

-- De hoofdpot is geen gewoon potje: niet verwijderen, niet hernoemen, en de
-- markering kan niet aan of uit gezet worden.
create or replace function public.protect_hoofdpot()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    -- Gaat de hele organisatie weg, dan mag de hoofdpot mee. Bij een cascade is
    -- de org-rij op dit moment al verdwenen, dus daaraan herkennen we het.
    -- Zonder deze uitzondering blokkeert de trigger delete_organisation.
    if old.is_hoofdpot and exists (
         select 1 from public.organisations o where o.id = old.organisation_id
       ) then
      raise exception 'De hoofdpot kan niet verwijderd worden'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if old.is_hoofdpot is distinct from new.is_hoofdpot then
    raise exception 'De hoofdpot-markering kan niet gewijzigd worden'
      using errcode = '42501';
  end if;
  if old.is_hoofdpot and new.name is distinct from old.name then
    raise exception 'De hoofdpot kan niet hernoemd worden'
      using errcode = '42501';
  end if;
  if old.is_hoofdpot and new.archived then
    raise exception 'De hoofdpot kan niet gearchiveerd worden'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists protect_hoofdpot_trigger on public.pots;
create trigger protect_hoofdpot_trigger
  before update or delete on public.pots
  for each row execute function public.protect_hoofdpot();


-- =============================================================================
-- 2. TRANSACTIONS WORDT ONAANRAAKBAAR
-- =============================================================================

alter table public.transactions
  add column if not exists allocated_amount numeric(12,2) not null default 0,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id);

create index if not exists transactions_open_idx
  on public.transactions(organisation_id)
  where voided_at is null;


-- =============================================================================
-- 3. ALLOCATIONS
-- =============================================================================
-- Eén rij per regel in het toewijs-paneel: welk potje krijgt welk deel van deze
-- bankregel. Meerdere per transactie is normaal, dat is splitsen.

create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations(id) on delete cascade,
  transaction_id uuid not null
    references public.transactions(id) on delete restrict,
  pot_id uuid not null
    references public.pots(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists allocations_transaction_idx on public.allocations(transaction_id);
create index if not exists allocations_pot_idx on public.allocations(pot_id);

alter table public.allocations enable row level security;

drop policy if exists allocations_select_for_pot_viewers on public.allocations;
create policy allocations_select_for_pot_viewers on public.allocations
  for select using (public.can_view_pot(pot_id));

drop policy if exists allocations_insert_for_pot_writers on public.allocations;
create policy allocations_insert_for_pot_writers on public.allocations
  for insert with check (public.can_write_pot(pot_id));

drop policy if exists allocations_update_for_pot_writers on public.allocations;
create policy allocations_update_for_pot_writers on public.allocations
  for update using (public.can_write_pot(pot_id));

drop policy if exists allocations_delete_for_pot_writers on public.allocations;
create policy allocations_delete_for_pot_writers on public.allocations
  for delete using (public.can_write_pot(pot_id));


-- =============================================================================
-- 4. DE GRENS AFDWINGEN
-- =============================================================================
-- CHECK kan niet over rijen kijken, dus een trigger houdt allocated_amount bij
-- en de CHECK bewaakt hem. De `for update` op de ouderrij serialiseert twee
-- gelijktijdige allocaties; zonder dat lezen ze allebei een verouderde som en
-- gaan ze samen over het bedrag heen.

create or replace function public.sync_allocated_amount()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tx uuid := coalesce(new.transaction_id, old.transaction_id);
begin
  perform 1 from public.transactions where id = v_tx for update;

  update public.transactions t
     set allocated_amount = coalesce(
           (select sum(a.amount) from public.allocations a
             where a.transaction_id = v_tx), 0)
   where t.id = v_tx;

  return coalesce(new, old);
end $$;

drop trigger if exists allocations_sync on public.allocations;
create trigger allocations_sync
  after insert or update or delete on public.allocations
  for each row execute function public.sync_allocated_amount();


-- Elke nieuwe transactie wordt meteen volledig gealloceerd, standaard naar de
-- hoofdpot. Zonder dit kan een bankregel bestaan waarvan een deel nergens
-- staat: niet in een potje en niet in de hoofdpot. Dan klopt
-- "totaal = som van de potjes" niet meer, en dat is precies de invariant die we
-- willen. Nu geldt altijd allocated_amount = amount, en toewijzen is het
-- verplaatsen van (een deel van) die allocatie.
--
-- coalesce op new.pot_id: zolang de app nog zelf een potje meegeeft bij insert
-- volgen we dat, zodat beide werelden hetzelfde zeggen.
create or replace function public.allocate_new_transaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_hoofd uuid;
begin
  select id into v_hoofd from public.pots
   where organisation_id = new.organisation_id and is_hoofdpot;
  if v_hoofd is null then
    raise exception 'Deze organisatie heeft geen hoofdpot'
      using errcode = '23502';
  end if;

  insert into public.allocations
    (organisation_id, transaction_id, pot_id, amount, created_by)
  values (new.organisation_id, new.id, coalesce(new.pot_id, v_hoofd),
          new.amount, auth.uid());

  return new;
end $$;

drop trigger if exists transactions_auto_allocate on public.transactions;
create trigger transactions_auto_allocate
  after insert on public.transactions
  for each row execute function public.allocate_new_transaction();


-- =============================================================================
-- 5. BESTAANDE TOEWIJZINGEN OMZETTEN
-- =============================================================================
-- Elke transactie krijgt één allocatie voor haar volle bedrag: naar het potje
-- waar ze al bij hoorde, of naar de hoofdpot als ze nog nergens bij hoorde.
--
-- Gesplitste transacties uit het oude model (een verkorte ouderrij plus
-- kinderen met split_from) worden hier gewoon als losse rijen behandeld. Het
-- geld klopt daardoor exact; alleen het originele bedrag van de ouderrij is
-- niet meer te achterhalen, en dat was al zo vóór deze migratie.
--
-- De oude verdeel-paren (transfer_group) migreren vanzelf goed mee: de
-- tegenboeking op de hoofdpot wordt een allocatie naar de hoofdpot en de
-- 'in'-regels worden allocaties naar hun potje. Netto klopt dat.

insert into public.allocations (organisation_id, transaction_id, pot_id, amount, created_at)
select t.organisation_id,
       t.id,
       coalesce(t.pot_id, h.id),
       t.amount,
       t.created_at
from public.transactions t
join public.pots h
  on h.organisation_id = t.organisation_id and h.is_hoofdpot
where not exists (
  select 1 from public.allocations a where a.transaction_id = t.id
);

-- De trigger hierboven heeft allocated_amount al bijgewerkt, maar bij een
-- bulk-insert op een lege tabel is het goedkoper en zekerder om hem hier nog
-- eens in één keer te zetten.
update public.transactions t
   set allocated_amount = coalesce(
         (select sum(a.amount) from public.allocations a
           where a.transaction_id = t.id), 0);

-- Pas nu de CHECK: eerst de data kloppend maken, anders blokkeert de constraint
-- zijn eigen migratie.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'transactions_allocated_within_amount'
  ) then
    alter table public.transactions
      add constraint transactions_allocated_within_amount
      check (allocated_amount >= 0 and allocated_amount <= amount);
  end if;
end $$;


-- =============================================================================
-- 5b. TOEWIJZEN ALS ÉÉN BEWERKING
-- =============================================================================
-- Toewijzen is geld verplaatsen van de hoofdpot naar een potje. De volgorde
-- luistert nauw: je moet eerst uit de hoofdpot halen en dan pas toekennen. Doe
-- je het omgekeerd, dan staat de som even boven het transactiebedrag en kapt de
-- CHECK je af. Dat hoort niet de zorg van de aanroeper te zijn, dus het zit
-- hier.
--
-- Geeft terug wat er na afloop nog in de hoofdpot staat voor deze transactie.

create or replace function public.assign_from_hoofdpot(
  p_transaction_id uuid,
  p_pot_id uuid,
  p_amount numeric
)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_org       uuid;
  v_hoofd     uuid;
  v_in_hoofd  numeric(12,2);
  v_rest      numeric(12,2);
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Bedrag moet groter zijn dan nul' using errcode = '22023';
  end if;

  select organisation_id into v_org
    from public.transactions where id = p_transaction_id for update;
  if v_org is null then
    raise exception 'Transactie bestaat niet' using errcode = '42704';
  end if;

  if not public.can_write_pot(p_pot_id) then
    raise exception 'Je mag niets in dit potje boeken' using errcode = '42501';
  end if;

  select id into v_hoofd from public.pots
   where organisation_id = v_org and is_hoofdpot;

  select coalesce(sum(amount), 0) into v_in_hoofd
    from public.allocations
   where transaction_id = p_transaction_id and pot_id = v_hoofd;

  if p_amount > v_in_hoofd then
    raise exception
      'Er staat nog % van deze transactie in de hoofdpot, dus % toewijzen kan niet. Is dit geld al verdeeld?',
      v_in_hoofd, p_amount using errcode = '23514';
  end if;

  -- Eerst weghalen bij de hoofdpot, dan pas toekennen.
  delete from public.allocations
   where transaction_id = p_transaction_id and pot_id = v_hoofd;

  v_rest := v_in_hoofd - p_amount;
  if v_rest > 0 then
    insert into public.allocations
      (organisation_id, transaction_id, pot_id, amount, created_by)
    values (v_org, p_transaction_id, v_hoofd, v_rest, auth.uid());
  end if;

  insert into public.allocations
    (organisation_id, transaction_id, pot_id, amount, created_by)
  values (v_org, p_transaction_id, p_pot_id, p_amount, auth.uid());

  return v_rest;
end $$;

grant execute on function public.assign_from_hoofdpot(uuid, uuid, numeric) to authenticated;


-- =============================================================================
-- 6. POTJESLIMIET, ZICHTBAARHEID EN SALDO'S
-- =============================================================================

-- De hoofdpot mag geen plek van het gratis plan opeten.
create or replace function public.enforce_pot_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tier public.sub_tier; v_count int; v_max int;
begin
  if new.is_hoofdpot then
    return new;
  end if;
  v_tier := public.org_tier(new.organisation_id);
  v_max := case v_tier when 'free' then 5 else 1000000 end;
  select count(*) into v_count
  from public.pots
  where organisation_id = new.organisation_id
    and archived = false
    and is_hoofdpot = false;
  if v_count >= v_max then
    raise exception
      'Je gratis plan staat maximaal % potjes toe. Upgrade naar Pro voor onbeperkt.', v_max
      using errcode = '23514';
  end if;
  return new;
end $$;

-- Zichtbaarheid gelijk houden aan vandaag. Onverdeeld geld was alleen voor
-- admins (zie de policy transactions_select_for_pot_viewers, die voor
-- pot_id IS NULL is_org_admin eist). Nu de hoofdpot een echt potje wordt zou
-- can_view_pot hem ook aan readers tonen, en dat is een uitbreiding van rechten
-- die niemand gevraagd heeft.
create or replace function public.can_view_pot(p_pot_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.pots p
    join public.memberships m on m.organisation_id = p.organisation_id
    where p.id = p_pot_id
      and m.user_id = auth.uid()
      and (
        case when p.is_hoofdpot
             then m.role = 'admin'
             else m.role in ('admin', 'reader')
               or (m.role = 'pot_owner' and m.pot_id = p.id)
        end
      )
  );
$$;

create or replace function public.can_write_pot(p_pot_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.pots p
    join public.memberships m on m.organisation_id = p.organisation_id
    where p.id = p_pot_id
      and m.user_id = auth.uid()
      and (
        case when p.is_hoofdpot
             then m.role = 'admin'
             else m.role = 'admin'
               or (m.role = 'pot_owner' and m.pot_id = p.id)
        end
      )
  );
$$;

-- Saldo's komen voortaan uit de allocaties. Kolommen blijven gelijk, anders
-- breken de consumers. transaction_count telt distinct transacties, anders telt
-- een gesplitste transactie dubbel.
create or replace view public.pot_balances as
select
  p.id as pot_id,
  p.organisation_id,
  p.name,
  p.color,
  p.target_amount,
  coalesce(sum(case when t.direction = 'in' then a.amount
                    else -a.amount end), 0) as balance,
  count(distinct t.id) as transaction_count
from public.pots p
left join public.allocations a on a.pot_id = p.id
left join public.transactions t
       on t.id = a.transaction_id and t.voided_at is null
where p.archived = false
group by p.id;


-- =============================================================================
-- CONTROLE
-- =============================================================================
-- Na het draaien horen deze drie allemaal leeg te zijn.
--
-- 1. Transacties zonder allocatie:
--    select count(*) from public.transactions t
--     where not exists (select 1 from public.allocations a
--                        where a.transaction_id = t.id);
--
-- 2. Transacties waar de allocaties niet optellen tot het bedrag:
--    select id, amount, allocated_amount from public.transactions
--     where allocated_amount <> amount and voided_at is null;
--
-- 3. Organisaties waar het totaal niet gelijk is aan de som van de potjes:
--    select o.name, tot.saldo, pot.saldo
--      from public.organisations o
--      join lateral (select sum(case when t.direction='in' then t.amount
--                                    else -t.amount end) saldo
--                      from public.transactions t
--                     where t.organisation_id = o.id and t.voided_at is null) tot on true
--      join lateral (select coalesce(sum(b.balance),0) saldo
--                      from public.pot_balances b
--                     where b.organisation_id = o.id) pot on true
--     where coalesce(tot.saldo,0) <> coalesce(pot.saldo,0);
