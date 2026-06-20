-- =============================================================================
-- Notificatie-voorkeuren per gebruiker in de DB
-- =============================================================================
-- Voorheen stonden de meldingsvoorkeuren in localStorage (per toestel). Nu in
-- de DB zodat de Edge Functions per ONTVANGER kunnen filteren: iedere admin/
-- potbeheerder kiest zelf welke mails hij krijgt.
--
-- De tabel notification_settings + RLS (own-row) + auto-rij-bij-signup bestaan
-- al (schema.sql). Hier voegen we de kolommen toe die matchen met de UI-toggles.
-- =============================================================================

alter table public.notification_settings
  add column if not exists email_on_transaction boolean not null default true;
alter table public.notification_settings
  add column if not exists email_on_pot_created boolean not null default false;
alter table public.notification_settings
  add column if not exists email_on_member_added boolean not null default true;
alter table public.notification_settings
  add column if not exists digest_frequency text not null default 'never';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'notification_settings_digest_check'
  ) then
    alter table public.notification_settings
      add constraint notification_settings_digest_check
      check (digest_frequency in ('never', 'daily', 'weekly'));
  end if;
end $$;

-- Backfill: zorg dat elke bestaande user een rij heeft (defaults).
insert into public.notification_settings (user_id)
select id from public.profiles
on conflict (user_id) do nothing;
