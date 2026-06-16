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

-- A PUBLISHED workflow fixture (fixed UUIDs) for the Story 3.1 anon viewer e2e:
-- 2 covered nodes (each a text sample output) + 1 edge. Owned by parintnk, status
-- published (so it never shows in "My drafts"). Seeded as the table owner → bypasses
-- the 2.1 column-locks; the published_has_ts CHECK (2.5) is satisfied by published_at.
-- last_verified_at is a fixed 14-day offset (not now()) so the Story 3.3 trust-row
-- e2e renders a deterministic "Last verified 2 weeks ago" (neutral, < 90-day stale)
-- instead of a timing-fragile "just now" when the seed runs < 60s before the assertion.
insert into public.workflows (id, author_id, profession_id, title, summary, status, published_at, last_verified_at)
values (
  '00000000-0000-0000-0000-0000000000aa',
  '00000000-0000-0000-0000-000000000001',
  (select id from public.professions where slug = 'ai-automation'),
  'Coffee shop brand kit',
  'A multi-tool recipe to generate a small brand kit end to end.',
  'published', now(), now() - interval '14 days'
)
on conflict (id) do nothing;

insert into public.workflow_nodes (id, workflow_id, idx, pos_x, pos_y, tool_name, prompt, purpose)
values
  ('00000000-0000-0000-0000-0000000000ab', '00000000-0000-0000-0000-0000000000aa', 0,
   0, 0, 'ChatGPT', 'Define a warm, artisanal brand direction', 'Set the visual direction first'),
  ('00000000-0000-0000-0000-0000000000ac', '00000000-0000-0000-0000-0000000000aa', 1,
   360, 40, 'Midjourney', 'Generate 4 logo concepts from the brief', 'Produce candidate logos')
on conflict (id) do nothing;

insert into public.node_outputs (node_id, kind, text_content)
values
  ('00000000-0000-0000-0000-0000000000ab', 'text', 'Brand direction: warm, artisanal, minimalist.'),
  ('00000000-0000-0000-0000-0000000000ac', 'text', 'Concept A/B/C/D — cup-and-steam marks.')
on conflict (node_id) do nothing;

insert into public.workflow_edges (workflow_id, source_node_id, target_node_id)
select '00000000-0000-0000-0000-0000000000aa',
       '00000000-0000-0000-0000-0000000000ab',
       '00000000-0000-0000-0000-0000000000ac'
where not exists (
  select 1 from public.workflow_edges
  where source_node_id = '00000000-0000-0000-0000-0000000000ab'
    and target_node_id = '00000000-0000-0000-0000-0000000000ac'
);

-- A SECOND published workflow fixture for the Story 4.1 outcome-vote e2e — kept
-- separate from …00aa so casting a vote here doesn't pollute the 3.3 anon-viewer
-- zero-state assertions on …00aa. 1 covered node; no votes seeded (counts start at 0).
insert into public.workflows (id, author_id, profession_id, title, summary, status, published_at, last_verified_at)
values (
  '00000000-0000-0000-0000-0000000000dd',
  '00000000-0000-0000-0000-000000000001',
  (select id from public.professions where slug = 'ai-automation'),
  'Newsletter summarizer',
  'Turn long threads into a tight newsletter.',
  'published', now(), now() - interval '14 days'
)
on conflict (id) do nothing;

insert into public.workflow_nodes (id, workflow_id, idx, pos_x, pos_y, tool_name, prompt, purpose)
values
  ('00000000-0000-0000-0000-0000000000de', '00000000-0000-0000-0000-0000000000dd', 0,
   0, 0, 'Claude', 'Summarize the thread into 5 bullets', 'Condense the source')
on conflict (id) do nothing;

insert into public.node_outputs (node_id, kind, text_content)
values
  ('00000000-0000-0000-0000-0000000000de', 'text', 'Five crisp bullets, ready to send.')
on conflict (node_id) do nothing;

-- A THIRD published workflow fixture for the Story 4.2 comment e2e — kept separate from
-- …00aa (3.3 anon zero-state) and …00dd (4.1 vote) so comment volume doesn't pollute
-- their assertions. The comment thread starts empty; the e2e posts into it.
insert into public.workflows (id, author_id, profession_id, title, summary, status, published_at, last_verified_at)
values (
  '00000000-0000-0000-0000-0000000000ee',
  '00000000-0000-0000-0000-000000000001',
  (select id from public.professions where slug = 'ai-automation'),
  'Prompt chaining starter',
  'Chain two models for a tighter draft.',
  'published', now(), now() - interval '7 days'
)
on conflict (id) do nothing;

insert into public.workflow_nodes (id, workflow_id, idx, pos_x, pos_y, tool_name, prompt, purpose)
values
  ('00000000-0000-0000-0000-0000000000ef', '00000000-0000-0000-0000-0000000000ee', 0,
   0, 0, 'ChatGPT', 'Draft an outline from the brief', 'Set the structure first')
on conflict (id) do nothing;

insert into public.node_outputs (node_id, kind, text_content)
values
  ('00000000-0000-0000-0000-0000000000ef', 'text', 'A three-part outline, ready to expand.')
on conflict (node_id) do nothing;
