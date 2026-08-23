-- Auth-users die de demo-seeds verwachten. Op Supabase maak je die via het
-- dashboard; lokaal zetten we ze er gewoon in.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'demo@kaspio.be',
   '{"full_name":"Demo penningmeester"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'lid@kaspio.be',
   '{"full_name":"Tweede lid"}'::jsonb)
on conflict (id) do nothing;

-- schema.sql hangt een trigger op auth.users die profiles vult. Die vuurt niet
-- met terugwerkende kracht, dus voor de zekerheid hier ook expliciet.
insert into public.profiles (id, email, full_name)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1))
from auth.users u
on conflict (id) do nothing;
