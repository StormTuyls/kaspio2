-- =============================================================================
-- Fix: dubbele admin/reader-memberships voorkomen
-- =============================================================================
-- De unique constraint (organisation_id, user_id, pot_id) dedupt NIET wanneer
-- pot_id NULL is (Postgres behandelt NULLs als verschillend). Daardoor konden
-- admin/reader-rijen dubbel ontstaan bij herhaald aanvaarden/redeemen.
--
-- De RPC's redeem_org_invite + accept_pending_invites guarden nu al met
-- `where not exists` (zie org-invite-tokens.sql / member-management.sql). Dit
-- bestand ruimt bestaande duplicaten op en legt een partiële unieke index als
-- harde garantie (ook tegen races).
-- =============================================================================

-- 1. Bestaande NULL-pot duplicaten opruimen: hou per (org, user) de hoogste rol
--    (admin > pot_owner > reader), bij gelijke rol de oudste rij.
with ranked as (
  select id,
    row_number() over (
      partition by organisation_id, user_id
      order by
        case role when 'admin' then 0 when 'pot_owner' then 1 else 2 end,
        created_at
    ) as rn
  from public.memberships
  where pot_id is null
)
delete from public.memberships
where id in (select id from ranked where rn > 1);

-- 2. Harde garantie: max één pot-loze membership per (org, user).
create unique index if not exists memberships_org_user_nopot_unique
  on public.memberships (organisation_id, user_id)
  where pot_id is null;

-- Verificatie:
--   select organisation_id, user_id, count(*) from public.memberships
--   where pot_id is null group by 1,2 having count(*) > 1;  -- moet leeg zijn
