-- =============================================================================
-- Kaspio , een verantwoordelijke per groep
-- =============================================================================
-- Een pot_owner-lidmaatschap wijst naar één potje. Wie een hele tak beheert
-- krijgt dus één rij per potje. Bij een club met comités loopt dat meteen uit
-- de hand: tien voorzitters over 118 posten werden 118 rijen. Drie dingen gaan
-- daar stuk.
--
--   1. Rechten geven is handwerk. Komt er een post bij, dan moet je eraan
--      denken de voorzitter er opnieuw aan te koppelen, en vergeet je dat, dan
--      ziet hij zijn eigen post niet.
--   2. Alles wat lidmaatschappen telt, telt rijen in plaats van mensen.
--   3. De bedoeling gaat verloren. "Anja beheert Dagelijks bestuur" is de
--      afspraak; tien losse potjes-rechten zijn daar maar een afgeleide van.
--
-- Daarom een rol die naar de groep wijst in plaats van naar het potje. Wie
-- group_owner is van een groep, ziet en beheert alles wat in die groep zit,
-- ook wat er later bij komt.
--
-- Bewust GEEN owner_id op pot_groups zelf. Lidmaatschappen zijn al de plek waar
-- rechten staan, en RLS leest daar. Een tweede plek met rechten is een tweede
-- plek om te vergeten. Bijkomend voordeel: een comité kan meer dan één
-- verantwoordelijke hebben, en dat komt vaker voor dan één.
--
-- Vereist dat 'group_owner' al aan public.member_role is toegevoegd. Dat
-- gebeurt in group-owner-enum.sql, een apart bestand omdat een nieuwe
-- enum-waarde niet bruikbaar is in de transactie waarin ze gemaakt wordt.
--
-- De RLS-functies die deze rol lezen staan NIET hier, maar in allocations.sql
-- en group-subgroups.sql. Zie deel 3 hieronder voor waarom.
--
-- Idempotent. Draai in de Supabase SQL-editor.
-- =============================================================================

-- =============================================================================
-- 1. KOLOM
-- =============================================================================

alter table public.memberships
  add column if not exists group_id uuid
    references public.pot_groups(id) on delete cascade;

create index if not exists memberships_group_idx
  on public.memberships(group_id) where group_id is not null;

-- Eén persoon hoort maar één keer bij dezelfde groep.
create unique index if not exists memberships_org_user_group_unique
  on public.memberships(organisation_id, user_id, group_id)
  where group_id is not null;

comment on column public.memberships.group_id is
  'Alleen voor group_owner: de groep waarvan dit lid alle potjes beheert. '
  'NULL voor admin, reader en pot_owner.';

-- =============================================================================
-- 2. CONSTRAINT
-- =============================================================================
-- Elke rol wijst naar precies het juiste ding: pot_owner naar een potje,
-- group_owner naar een groep, admin en reader naar geen van beide.

alter table public.memberships
  drop constraint if exists memberships_role_pot_check;

alter table public.memberships
  add constraint memberships_role_pot_check check (
    (role = 'pot_owner'   and pot_id is not null and group_id is null)
    or (role = 'group_owner' and group_id is not null and pot_id is null)
    or (role in ('admin', 'reader') and pot_id is null and group_id is null)
  );

-- =============================================================================
-- 3. ZICHTBAARHEID EN SCHRIJFRECHT , staat niet hier
-- =============================================================================
-- can_view_pot en can_write_pot kregen hier ooit hun group_owner-tak, in een
-- kopie van de versie uit allocations.sql. Dat werkte alleen zolang niemand die
-- twee bestanden in de verkeerde volgorde draaide: wie als laatste liep, won,
-- en de kopie hier miste bijvoorbeeld de subgroep-overerving.
--
-- Bovendien kon dit bestand daardoor niet vóór allocations.sql draaien (de
-- functies noemen p.is_hoofdpot) terwijl allocations.sql wél de kolom
-- memberships.group_id uit deel 1 hierboven nodig heeft. Een kringetje.
--
-- Dus: dit bestand levert alleen nog de kolom en de constraint. De twee
-- functies staan in allocations.sql en, met de overerving naar subgroepen
-- erbij, in group-subgroups.sql. Dat laatste is de versie die telt.
-- Laadvolgorde: group-owners.sql, dan allocations.sql, dan group-subgroups.sql.

-- =============================================================================
-- 4. RECHTEN ZETTEN
-- =============================================================================
-- Zelfde functie als voorheen, met een lijst groepen erbij. De oude aanroep met
-- vier argumenten blijft werken: p_group_ids heeft een default.

-- create or replace met een extra parameter maakt een NIEUWE functie in plaats
-- van de bestaande te vervangen. Blijven ze allebei staan, dan weet PostgREST
-- niet welke je bedoelt en geeft elke aanroep 400. Dus eerst de oude weg.
drop function if exists public.set_member_permissions(uuid, uuid, public.member_role, uuid[]);

create or replace function public.set_member_permissions(
  p_org_id uuid,
  p_user_id uuid,
  p_role public.member_role,
  p_pot_ids uuid[] default null,
  p_group_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_count int;
  v_was_admin boolean;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Alleen org-admins kunnen rechten wijzigen';
  end if;

  if p_role = 'pot_owner' and (p_pot_ids is null or array_length(p_pot_ids, 1) = 0) then
    raise exception 'Pot owner moet minstens één potje toegewezen krijgen';
  end if;

  if p_role = 'group_owner' and (p_group_ids is null or array_length(p_group_ids, 1) = 0) then
    raise exception 'Een groepsbeheerder moet minstens één groep toegewezen krijgen';
  end if;

  -- Een organisatie zonder admin is niet meer te beheren.
  select exists(
    select 1 from public.memberships
    where organisation_id = p_org_id and user_id = p_user_id and role = 'admin'
  ) into v_was_admin;

  select count(*) into v_admin_count
  from public.memberships
  where organisation_id = p_org_id
    and role = 'admin'
    and user_id != p_user_id;

  if v_was_admin and p_role != 'admin' and v_admin_count = 0 then
    raise exception 'Kan laatste admin niet degraderen. Wijs eerst iemand anders aan als admin.';
  end if;

  delete from public.memberships
  where organisation_id = p_org_id and user_id = p_user_id;

  if p_role = 'admin' then
    insert into public.memberships (organisation_id, user_id, role)
    values (p_org_id, p_user_id, 'admin');
  elsif p_role = 'reader' then
    insert into public.memberships (organisation_id, user_id, role)
    values (p_org_id, p_user_id, 'reader');
  elsif p_role = 'pot_owner' then
    insert into public.memberships (organisation_id, user_id, role, pot_id)
    select distinct p_org_id, p_user_id, 'pot_owner'::public.member_role,
           unnest(p_pot_ids);
  elsif p_role = 'group_owner' then
    -- distinct: twee keer dezelfde groep meesturen mag geen unique violation
    -- geven, dat is geen fout van de gebruiker.
    --
    -- De cast is nodig, niet cosmetisch. Een kale literal heeft type "unknown"
    -- en wordt in een VALUES-lijst nog naar member_role gecoerced, maar SELECT
    -- DISTINCT dwingt de typebepaling eerder af en kiest dan text. Zonder cast
    -- faalt de insert met "column role is of type member_role but expression is
    -- of type text".
    insert into public.memberships (organisation_id, user_id, role, group_id)
    select distinct p_org_id, p_user_id, 'group_owner'::public.member_role,
           unnest(p_group_ids);
  end if;
end;
$$;

grant execute on function public.set_member_permissions(uuid, uuid, public.member_role, uuid[], uuid[])
  to authenticated;

-- Verificatie:
--   select role, count(*) from public.memberships group by role;
--   select public.can_view_pot('<pot-uuid>');
-- =============================================================================
