-- =============================================================================
-- In-app feedback (bug / idee / andere) van ingelogde gebruikers
-- =============================================================================
-- Eén tabel + strikte RLS: ingelogde users mogen enkel hun EIGEN feedback
-- toevoegen, niemand kan via de API feedback lezen. Lezen gebeurt via de
-- admin-view (SQL-editor / service_role), net als de analyse-views.
--
-- E-mailmelding loopt via de Edge Function send-feedback-email (best-effort);
-- ook zonder mail blijft de rij bewaard en leesbaar via admin.feedback_overview.
--
-- Idempotent: veilig om opnieuw te draaien.
-- =============================================================================

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  organisation_id uuid references public.organisations(id) on delete set null,
  kind text not null check (kind in ('bug', 'idea', 'other')),
  message text not null check (length(message) between 1 and 4000),
  context jsonb,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback(created_at desc);

alter table public.feedback enable row level security;

-- Ingelogde users mogen enkel hun eigen feedback toevoegen.
drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid());

-- Bewust GEEN select/update/delete-policy: feedback is niet leesbaar via de API.
-- Lezen via admin.feedback_overview of de service_role.
grant insert on public.feedback to authenticated;

-- -----------------------------------------------------------------------------
-- Admin-view om feedback te lezen (zelfde 'admin'-schema als de analyse-views).
-- -----------------------------------------------------------------------------
create schema if not exists admin;
revoke all on schema admin from anon, authenticated;

create or replace view admin.feedback_overview as
select
  f.id,
  f.created_at,
  f.kind,
  f.message,
  pr.email as user_email,
  o.name   as org_name,
  f.context,
  f.organisation_id,
  f.user_id
from public.feedback f
left join public.profiles pr      on pr.id = f.user_id
left join public.organisations o  on o.id = f.organisation_id;

revoke all on admin.feedback_overview from anon, authenticated;
grant usage on schema admin to service_role;
grant select on admin.feedback_overview to service_role;
