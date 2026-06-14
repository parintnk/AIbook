-- Local-only seed (runs on `supabase start` / `supabase db reset`). NOT applied
-- to remote — only migrations are pushed. Seeds the `parintnk` public profile
-- the e2e profile specs assert against, so they pass on the local stack the way
-- they do against the real project.

-- A confirmed email user. The `on_auth_user_created` trigger derives the handle
-- "parintnk" from the email local-part and creates its public.profiles row.
-- (No password — nothing signs in as this user; the profile specs read the
-- public profile anonymously.)
insert into auth.users (
  instance_id, id, aud, role, email,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'parintnk@example.com',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', ''
)
on conflict (id) do nothing;

-- Primary profession (rendered as a chip on the public profile) + a display name.
update public.profiles
set
  primary_profession_id = (
    select id from public.professions where slug = 'ai-automation'
  ),
  display_name = 'Parin'
where handle = 'parintnk';

-- One AI Stack item so the "AI Stack" section renders on the public profile.
insert into public.ai_stack_items (profile_id, tool_name, skill_level, sort_order)
select p.id, 'n8n', 5, 0
from public.profiles p
where p.handle = 'parintnk'
  and not exists (
    select 1 from public.ai_stack_items a
    where a.profile_id = p.id and a.tool_name = 'n8n'
  );
