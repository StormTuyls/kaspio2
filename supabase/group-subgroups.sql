-- =============================================================================
-- Kaspio , subgroepen onder een potgroep
-- =============================================================================
-- Een echt rekeningschema heeft drie niveaus boven de boeking: comité, blok,
-- post. Kaspio had er twee: groep en potje. Daardoor kon je maar twee van deze
-- drie dingen tegelijk hebben: één groep per comité, bloktotalen die Kaspio
-- zelf rekent, en een budget per post.
--
-- Met een parent_id op pot_groups heb je alle drie. "Infrastructuur" wordt één
-- groep met de subgroepen "Investeringen", "Onderhoud" en "Energie, water &
-- huur", en de posten blijven potjes met hun eigen budget.
--
-- Gekozen gedrag:
--   * Eén niveau diep. Een subgroep kan zelf geen subgroepen hebben. De
--     databank dwingt dat af, niet de UI.
--   * Een potje mag rechtstreeks in een hoofdgroep hangen. Nodig voor de
--     comités zonder blokken; anders zou je overal een kunstmatige subgroep
--     moeten maken.
--   * Een hoofdgroep verwijderen maakt haar subgroepen hoofdgroep. Ze blijven
--     bestaan, hun potjes verhuizen niet. Dat spiegelt wat er al gebeurt als je
--     een groep verwijdert: de potjes blijven en worden groepsloos.
--
-- Draai NA unallocated-and-groups.sql (pot_groups), group-owners.sql
-- (memberships.group_id) en allocations.sql (pots.is_hoofdpot). Dit bestand is
-- de laatste die can_view_pot en can_write_pot herschrijft.
--
-- Idempotent. Draai in de Supabase SQL-editor.
-- =============================================================================

-- =============================================================================
-- 1. KOLOM
-- =============================================================================
-- on delete set null is precies het gekozen gedrag: verdwijnt de hoofdgroep,
-- dan komen haar subgroepen bovenaan te staan. Bewust anders dan
-- memberships.group_id, dat on delete cascade is: daar is de rij zonder groep
-- betekenisloos, hier niet.

alter table public.pot_groups
  add column if not exists parent_id uuid
    references public.pot_groups(id) on delete set null;

create index if not exists pot_groups_parent_idx
  on public.pot_groups(parent_id) where parent_id is not null;

comment on column public.pot_groups.parent_id is
  'De hoofdgroep waar deze subgroep onder hangt. NULL = hoofdgroep. '
  'Maximaal één niveau diep, afgedwongen door check_group_depth.';

-- =============================================================================
-- 2. NAAMREGEL
-- =============================================================================
-- De oude index verbood "Bar > Inkomsten" naast "Tennisschool > Inkomsten", en
-- dat is precies wat je met subgroepen gaat willen. Dus: hoofdgroepen uniek
-- binnen de organisatie, subgroepen uniek binnen hun hoofdgroep.

drop index if exists pot_groups_org_name_unique;

create unique index if not exists pot_groups_root_name_unique
  on public.pot_groups (organisation_id, lower(name)) where parent_id is null;

create unique index if not exists pot_groups_child_name_unique
  on public.pot_groups (parent_id, lower(name)) where parent_id is not null;

-- =============================================================================
-- 3. ÉÉN NIVEAU DIEP
-- =============================================================================
-- Een check-constraint kan dit niet: het vereist een lookup in dezelfde tabel.
-- Dus een trigger. Die weigert vier dingen:
--
--   1. een kleinkind: de ouder heeft zelf al een ouder
--   2. een ouder worden terwijl je al kinderen hebt
--   3. je eigen ouder zijn
--   4. een ouder in een andere organisatie
--
-- Punt 3 en 4 komen er gratis bij omdat de trigger er toch is. Zonder 4 zou je
-- via de API een groep onder de groep van een andere klant kunnen hangen; de
-- RLS op pot_groups kijkt alleen naar organisation_id van de rij zelf.

create or replace function public.check_group_depth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_org uuid;
  v_parent_parent uuid;
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Een groep kan niet haar eigen hoofdgroep zijn.'
        using errcode = '23514';
    end if;

    select organisation_id, parent_id
      into v_parent_org, v_parent_parent
      from public.pot_groups
     where id = new.parent_id;

    if v_parent_org is null then
      raise exception 'De gekozen hoofdgroep bestaat niet.'
        using errcode = '23514';
    end if;

    if v_parent_org <> new.organisation_id then
      raise exception 'Een hoofdgroep moet in dezelfde organisatie zitten.'
        using errcode = '23514';
    end if;

    if v_parent_parent is not null then
      raise exception 'Een subgroep kan zelf geen subgroepen hebben. Kies een hoofdgroep.'
        using errcode = '23514';
    end if;

    if exists (select 1 from public.pot_groups where parent_id = new.id) then
      raise exception 'Deze groep heeft zelf al subgroepen en kan er dus niet onder een andere hangen.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists check_group_depth_trigger on public.pot_groups;
create trigger check_group_depth_trigger
  before insert or update on public.pot_groups
  for each row execute function public.check_group_depth();

-- =============================================================================
-- 4. RLS: DE GROEPSBEHEERDER ERFT NAAR BENEDEN
-- =============================================================================
-- can_view_pot en can_write_pot matchten m.group_id exact op p.group_id. Wie
-- "Infrastructuur" beheert zag daardoor niets in "Infrastructuur > Onderhoud",
-- terwijl daar juist zijn posten in zitten. Dus ook matchen op de ouder van de
-- groep van het potje. Eén lookup, geen recursie, want dieper dan één niveau
-- kan niet (zie 3).
--
-- LET OP: deze twee functies staan ook in allocations.sql, zonder de
-- subgroep-tak. Wie als laatste draait wint, en dit bestand is de bedoelde
-- laatste. Wijzig je er één, wijzig dan allebei.

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
               or (m.role = 'group_owner' and (
                     m.group_id = p.group_id
                     or m.group_id = (select g.parent_id from public.pot_groups g
                                       where g.id = p.group_id)
                   ))
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
               or (m.role = 'group_owner' and (
                     m.group_id = p.group_id
                     or m.group_id = (select g.parent_id from public.pot_groups g
                                       where g.id = p.group_id)
                   ))
        end
      )
  );
$$;

-- Verificatie:
--   -- kleinkind moet stuklopen
--   insert into public.pot_groups (organisation_id, name, parent_id)
--   values ('<org>', 'Te diep', '<id van een subgroep>');
--
--   -- zelfde naam onder verschillende hoofdgroepen mag
--   select p.name || ' > ' || c.name
--     from public.pot_groups c join public.pot_groups p on p.id = c.parent_id;
-- =============================================================================
