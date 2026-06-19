-- =============================================================================
-- Potgroepen = Team-feature (server-side afgedwongen)
-- =============================================================================
-- Alleen orgs op het Team-plan mogen potgroepen aanmaken. De frontend verbergt
-- de knop al, maar deze BEFORE INSERT trigger zorgt dat het niet te omzeilen is
-- via de API. Bestaande groepen (bv. na een downgrade) blijven gewoon staan.
-- =============================================================================

create or replace function public.enforce_group_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.org_tier(new.organisation_id) <> 'team' then
    raise exception
      'Potgroepen zijn een Team-functie. Upgrade naar Team om groepen te gebruiken.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_group_tier_trigger on public.pot_groups;
create trigger enforce_group_tier_trigger
  before insert on public.pot_groups
  for each row execute function public.enforce_group_tier();

-- Verificatie:
--   select tgname from pg_trigger where tgname = 'enforce_group_tier_trigger';
