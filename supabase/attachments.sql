-- =============================================================================
-- Bijlagen bij transacties (Team-feature)
-- =============================================================================
-- Bonnetjes/facturen koppelen aan een transactie. Bestanden in Storage-bucket
-- 'attachments', metadata in public.transaction_attachments. Team-only (trigger
-- + frontend). Padconventie: {orgId}/{transactionId}/{bestandsnaam}.
-- =============================================================================

-- 1. Private storage bucket
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- 2. Metadata-tabel
create table if not exists public.transaction_attachments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  path text not null,
  name text not null,
  size int,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists transaction_attachments_txn_idx
  on public.transaction_attachments(transaction_id);

alter table public.transaction_attachments enable row level security;

drop policy if exists "attach_select_members" on public.transaction_attachments;
create policy "attach_select_members" on public.transaction_attachments
  for select using (public.is_org_member(organisation_id));

drop policy if exists "attach_insert_admin" on public.transaction_attachments;
create policy "attach_insert_admin" on public.transaction_attachments
  for insert with check (public.is_org_admin(organisation_id));

drop policy if exists "attach_delete_admin" on public.transaction_attachments;
create policy "attach_delete_admin" on public.transaction_attachments
  for delete using (public.is_org_admin(organisation_id));

-- 3. Team-gate (server-side)
create or replace function public.enforce_attachment_tier()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.org_tier(new.organisation_id) <> 'team' then
    raise exception 'Bijlagen zijn een Team-functie. Upgrade naar Team.'
      using errcode = '23514';
  end if;
  return new;
end; $$;
drop trigger if exists enforce_attachment_tier_trigger on public.transaction_attachments;
create trigger enforce_attachment_tier_trigger
  before insert on public.transaction_attachments
  for each row execute function public.enforce_attachment_tier();

-- 4. Storage RLS op de 'attachments'-bucket (org-map = eerste pad-segment)
drop policy if exists "attach_obj_select" on storage.objects;
create policy "attach_obj_select" on storage.objects for select
  using (
    bucket_id = 'attachments'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "attach_obj_insert" on storage.objects;
create policy "attach_obj_insert" on storage.objects for insert
  with check (
    bucket_id = 'attachments'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "attach_obj_delete" on storage.objects;
create policy "attach_obj_delete" on storage.objects for delete
  using (
    bucket_id = 'attachments'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );

-- Verificatie:
--   select id, public from storage.buckets where id = 'attachments';
