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

-- A deterministic LINEAGE TREE fixture for the Story 5.3 lineage-tree e2e (the seed otherwise has
-- NO fork lineage — no workflow has a parent_id). A published root → child → grandchild chain, all
-- owned by parintnk. Inserted root-first so the Story 5.1 `maintain_workflow_lineage` AFTER-INSERT
-- trigger sees each parent's closure rows already present → it auto-builds the closure
-- (fa,fb,1)/(fa,fc,2)/(fb,fc,1) + the self-rows + increments each parent's fork_count. Seeded as the
-- table owner → bypasses the 2.1 column-locks on `parent_id`/counters. Kept on FRESH ids (…fa/…fb/
-- …fc + nodes …b1/…b2/…b3) so it never touches …00aa (the 3.3 zero-fork assertion) or …00ee.
insert into public.workflows (id, author_id, profession_id, title, summary, status, published_at, last_verified_at)
values (
  '00000000-0000-0000-0000-0000000000fa',
  '00000000-0000-0000-0000-000000000001',
  (select id from public.professions where slug = 'ai-automation'),
  'Brand kit — origin recipe',
  'The original multi-tool brand-kit recipe that others forked and adapted.',
  'published', now(), now() - interval '20 days'
)
on conflict (id) do nothing;

insert into public.workflows (id, author_id, profession_id, title, summary, status, parent_id, published_at, last_verified_at, tried_count, worked_count, worked_score)
values (
  '00000000-0000-0000-0000-0000000000fb',
  '00000000-0000-0000-0000-000000000001',
  (select id from public.professions where slug = 'ai-automation'),
  'Café rebrand — pastel fork',
  'A softer, pastel-leaning fork of the origin brand kit.',
  'published', '00000000-0000-0000-0000-0000000000fa', now(), now() - interval '12 days',
  12, 11, 0.92
)
on conflict (id) do nothing;

insert into public.workflows (id, author_id, profession_id, title, summary, status, parent_id, published_at, last_verified_at)
values (
  '00000000-0000-0000-0000-0000000000fc',
  '00000000-0000-0000-0000-000000000001',
  (select id from public.professions where slug = 'ai-automation'),
  'Matcha café kit',
  'A matcha-shop spin forked from the pastel rebrand.',
  'published', '00000000-0000-0000-0000-0000000000fb', now(), now() - interval '4 days'
)
on conflict (id) do nothing;

insert into public.workflow_nodes (id, workflow_id, idx, pos_x, pos_y, tool_name, prompt, purpose)
values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000fa', 0,
   0, 0, 'ChatGPT', 'Define a warm, artisanal brand direction', 'Set the visual direction'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000fb', 0,
   0, 0, 'ChatGPT', 'Shift the palette to soft pastels', 'Rework the direction'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000fc', 0,
   0, 0, 'Midjourney', 'Generate matcha-themed brand marks', 'Produce candidate logos')
on conflict (id) do nothing;

insert into public.node_outputs (node_id, kind, text_content)
values
  ('00000000-0000-0000-0000-0000000000b1', 'text', 'Brand direction: warm, artisanal, minimalist.'),
  ('00000000-0000-0000-0000-0000000000b2', 'text', 'Palette: soft sage, blush, cream.'),
  ('00000000-0000-0000-0000-0000000000b3', 'text', 'Concept marks: whisk-and-leaf motifs.')
on conflict (node_id) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- Story 6.1 — the Explore feed fixture: a multi-profession published feed so the
-- Trending grid, profession chips, Load more ("Showing X of Y" → "caught up") and
-- the "New this week" rail are all demonstrable. 14 published workflows across the
-- 6 real professions, 4 authors, varied fork_count / tried_count / worked_score
-- (seeded as a 0–1 RATIO — the …00fb convention; the recompute would store a
-- weighted count, see deferred-work) and recency. Output kinds vary to exercise all
-- thumbnail kits (text→doc, file→sheet, video→video, image→logo); image/video/file
-- carry a placeholder storage_path (no real object — the feed only signs IMAGE urls
-- and falls back to a wash on failure). New id ranges (…0c00NN / …0d00NN / …00d1-d3)
-- avoid colliding with …00aa/dd/ee/fa/fb/fc/ab/ac/de/ef/b1/b2/b3. Local-only seed.

-- Three extra authors so the feed reads multi-author (the trigger derives the handle
-- from the email local-part + creates the public.profiles row).
insert into auth.users (
  instance_id, id, aud, role, email,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000d1',
   'authenticated', 'authenticated', 'devjun@example.com', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000d2',
   'authenticated', 'authenticated', 'priya@example.com', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000d3',
   'authenticated', 'authenticated', 'maris@example.com', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', '', '', '', '')
on conflict (id) do nothing;

update public.profiles set display_name = 'Jun',
  primary_profession_id = (select id from public.professions where slug = 'web-developer')
  where handle = 'devjun';
update public.profiles set display_name = 'Priya',
  primary_profession_id = (select id from public.professions where slug = 'ai-automation')
  where handle = 'priya';
update public.profiles set display_name = 'Maris',
  primary_profession_id = (select id from public.professions where slug = 'video-creator')
  where handle = 'maris';

insert into public.workflows
  (id, author_id, profession_id, title, summary, status, published_at, fork_count, tried_count, worked_score)
values
  ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000000d1', (select id from public.professions where slug = 'web-developer'),   'SaaS landing page from a one-line brief',     'Turn a single sentence into a full, sectioned landing page.',          'published', now() - interval '2 hours', 312, 40, 0.95),
  ('00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-0000000000d2', (select id from public.professions where slug = 'ai-automation'),   'Revenue dashboard from a raw CSV export',      'Clean, join, and chart a messy export into a board-ready dashboard.',  'published', now() - interval '7 hours', 264, 33, 0.91),
  ('00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-0000000000d3', (select id from public.professions where slug = 'video-creator'),   'YouTube short from a blog post in 6 cuts',     'Cut a long-form post into a punchy vertical short with captions.',     'published', now() - interval '1 day',   198, 28, 0.88),
  ('00000000-0000-0000-0000-0000000c0004', '00000000-0000-0000-0000-000000000001', (select id from public.professions where slug = 'graphic-designer'), 'Cohesive 24-icon set in one style pass',       'Generate a consistent icon family from one style reference.',          'published', now() - interval '1 day',   164, 22, 0.92),
  ('00000000-0000-0000-0000-0000000c0005', '00000000-0000-0000-0000-000000000001', (select id from public.professions where slug = 'marketer'),         'Launch email sequence from a product brief',   'A five-email launch sequence drafted from one product brief.',         'published', now() - interval '2 days',  141, 19, 0.90),
  ('00000000-0000-0000-0000-0000000c0006', '00000000-0000-0000-0000-0000000000d1', (select id from public.professions where slug = 'content-writer'),   'SEO blog draft from a keyword + outline',      'A search-tuned draft from a target keyword and a rough outline.',      'published', now() - interval '2 days',  129, 25, 0.93),
  ('00000000-0000-0000-0000-0000000c0007', '00000000-0000-0000-0000-0000000000d1', (select id from public.professions where slug = 'web-developer'),   'Pricing page A/B variants in one prompt',      'Two distinct pricing-page directions to test from one prompt.',        'published', now() - interval '3 days',  118, 14, 0.86),
  ('00000000-0000-0000-0000-0000000c0008', '00000000-0000-0000-0000-0000000000d2', (select id from public.professions where slug = 'content-writer'),   'Newsletter from this week''s commits',         'Turn a week of git history into a friendly product newsletter.',       'published', now() - interval '3 days',  96,  9,  0.84),
  ('00000000-0000-0000-0000-0000000c0009', '00000000-0000-0000-0000-0000000000d2', (select id from public.professions where slug = 'ai-automation'),   'Churn cohort heatmap from a Stripe export',    'Bucket customers into cohorts and chart retention from an export.',    'published', now() - interval '4 days',  88,  11, 0.80),
  ('00000000-0000-0000-0000-0000000c0010', '00000000-0000-0000-0000-0000000000d3', (select id from public.professions where slug = 'video-creator'),   'Podcast clip pack — 8 vertical highlights',    'Find the hooks and cut eight share-ready vertical clips.',             'published', now() - interval '5 days',  76,  7,  0.83),
  ('00000000-0000-0000-0000-0000000c0011', '00000000-0000-0000-0000-000000000001', (select id from public.professions where slug = 'graphic-designer'), 'App icon in 6 platform sizes, one pass',       'One concept exported to every platform icon size in a single pass.',   'published', now() - interval '6 days',  61,  6,  0.91),
  ('00000000-0000-0000-0000-0000000c0012', '00000000-0000-0000-0000-0000000000d3', (select id from public.professions where slug = 'marketer'),         'Cold-email sequence that books demos',         'A four-touch cold sequence tuned to book qualified demos.',            'published', now() - interval '8 days',  44,  5,  0.78),
  ('00000000-0000-0000-0000-0000000c0013', '00000000-0000-0000-0000-0000000000d1', (select id from public.professions where slug = 'web-developer'),   'Component library audit + cleanup plan',       'Audit a component library and produce a prioritised cleanup plan.',    'published', now() - interval '10 days', 30,  3,  0.74),
  ('00000000-0000-0000-0000-0000000c0014', '00000000-0000-0000-0000-000000000001', (select id from public.professions where slug = 'content-writer'),   'Case study from a customer interview',         'Shape a raw interview transcript into a polished case study.',         'published', now() - interval '12 days', 12,  0,  0)
on conflict (id) do nothing;

insert into public.workflow_nodes (id, workflow_id, idx, pos_x, pos_y, tool_name, prompt, purpose)
values
  ('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-0000000c0001', 0, 0, 0, 'ChatGPT',    'Draft a sectioned landing page from the brief', 'Produce the page'),
  ('00000000-0000-0000-0000-0000000d0002', '00000000-0000-0000-0000-0000000c0002', 0, 0, 0, 'Claude',     'Clean and chart the CSV into a dashboard',      'Build the dashboard'),
  ('00000000-0000-0000-0000-0000000d0003', '00000000-0000-0000-0000-0000000c0003', 0, 0, 0, 'Descript',   'Cut the post into a vertical short',            'Produce the short'),
  ('00000000-0000-0000-0000-0000000d0004', '00000000-0000-0000-0000-0000000c0004', 0, 0, 0, 'Midjourney', 'Generate a cohesive icon family',               'Produce the icons'),
  ('00000000-0000-0000-0000-0000000d0005', '00000000-0000-0000-0000-0000000c0005', 0, 0, 0, 'ChatGPT',    'Draft a five-email launch sequence',            'Write the sequence'),
  ('00000000-0000-0000-0000-0000000d0006', '00000000-0000-0000-0000-0000000c0006', 0, 0, 0, 'ChatGPT',    'Write an SEO draft from the keyword + outline', 'Write the draft'),
  ('00000000-0000-0000-0000-0000000d0007', '00000000-0000-0000-0000-0000000c0007', 0, 0, 0, 'ChatGPT',    'Draft two pricing-page variants',               'Produce variants'),
  ('00000000-0000-0000-0000-0000000d0008', '00000000-0000-0000-0000-0000000c0008', 0, 0, 0, 'Claude',     'Summarise the week''s commits into a newsletter','Write the newsletter'),
  ('00000000-0000-0000-0000-0000000d0009', '00000000-0000-0000-0000-0000000c0009', 0, 0, 0, 'Claude',     'Bucket cohorts and chart retention',            'Build the heatmap'),
  ('00000000-0000-0000-0000-0000000d0010', '00000000-0000-0000-0000-0000000c0010', 0, 0, 0, 'Descript',   'Find hooks and cut eight clips',                'Produce the clips'),
  ('00000000-0000-0000-0000-0000000d0011', '00000000-0000-0000-0000-0000000c0011', 0, 0, 0, 'Figma AI',   'Export the icon to every platform size',        'Produce the icons'),
  ('00000000-0000-0000-0000-0000000d0012', '00000000-0000-0000-0000-0000000c0012', 0, 0, 0, 'ChatGPT',    'Draft a four-touch cold sequence',              'Write the sequence'),
  ('00000000-0000-0000-0000-0000000d0013', '00000000-0000-0000-0000-0000000c0013', 0, 0, 0, 'Claude',     'Audit the component library',                   'Produce the plan'),
  ('00000000-0000-0000-0000-0000000d0014', '00000000-0000-0000-0000-0000000c0014', 0, 0, 0, 'ChatGPT',    'Shape the interview into a case study',         'Write the case study')
on conflict (id) do nothing;

-- Outputs: text kinds carry text_content; binary kinds (file/video/image) carry a
-- placeholder storage_path + mime (no real object — satisfies the kind/payload CHECK;
-- the feed only signs IMAGE urls and degrades to a wash on failure).
insert into public.node_outputs (node_id, kind, storage_path, text_content, mime, bytes)
values
  ('00000000-0000-0000-0000-0000000d0001', 'text',  null,                    'A sectioned hero + features + pricing page.',        null,              null),
  ('00000000-0000-0000-0000-0000000d0002', 'file',  'seed/0c0002/main.csv',  null,                                                 'text/csv',        51200),
  ('00000000-0000-0000-0000-0000000d0003', 'video', 'seed/0c0003/main.mp4',  null,                                                 'video/mp4',       2048000),
  ('00000000-0000-0000-0000-0000000d0004', 'image', 'seed/0c0004/main.webp', null,                                                 'image/webp',      204800),
  ('00000000-0000-0000-0000-0000000d0005', 'text',  null,                    'Email 1–5: tease, value, proof, offer, last call.',  null,              null),
  ('00000000-0000-0000-0000-0000000d0006', 'text',  null,                    'An H1 + intro + 5 sections + a meta description.',   null,              null),
  ('00000000-0000-0000-0000-0000000d0007', 'text',  null,                    'Variant A (value-first) and B (savings-first).',     null,              null),
  ('00000000-0000-0000-0000-0000000d0008', 'text',  null,                    'A 6-paragraph product newsletter from the diffs.',   null,              null),
  ('00000000-0000-0000-0000-0000000d0009', 'file',  'seed/0c0009/main.csv',  null,                                                 'text/csv',        51200),
  ('00000000-0000-0000-0000-0000000d0010', 'video', 'seed/0c0010/main.mp4',  null,                                                 'video/mp4',       2048000),
  ('00000000-0000-0000-0000-0000000d0011', 'image', 'seed/0c0011/main.webp', null,                                                 'image/webp',      204800),
  ('00000000-0000-0000-0000-0000000d0012', 'file',  'seed/0c0012/main.pdf',  null,                                                 'application/pdf', 153600),
  ('00000000-0000-0000-0000-0000000d0013', 'file',  'seed/0c0013/main.pdf',  null,                                                 'application/pdf', 153600),
  ('00000000-0000-0000-0000-0000000d0014', 'text',  null,                    'A 900-word case study with a results callout.',     null,              null)
on conflict (node_id) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- Story 6.2 — tags + workflow_tags + profession memberships
-- ───────────────────────────────────────────────────────────────────────────

-- Curated tag set (id range …0e00NN — no collision with …0c/0d/00aa-fc/d1-d3).
insert into public.tags (id, slug, label) values
  ('00000000-0000-0000-0000-0000000e0001', 'automation',   'Automation'),
  ('00000000-0000-0000-0000-0000000e0002', 'design',       'Design'),
  ('00000000-0000-0000-0000-0000000e0003', 'branding',     'Branding'),
  ('00000000-0000-0000-0000-0000000e0004', 'copywriting',  'Copywriting'),
  ('00000000-0000-0000-0000-0000000e0005', 'video',        'Video'),
  ('00000000-0000-0000-0000-0000000e0006', 'data',         'Data'),
  ('00000000-0000-0000-0000-0000000e0007', 'seo',          'SEO'),
  ('00000000-0000-0000-0000-0000000e0008', 'email',        'Email'),
  ('00000000-0000-0000-0000-0000000e0009', 'icons',        'Icons'),
  ('00000000-0000-0000-0000-0000000e000a', 'dashboard',    'Dashboard'),
  ('00000000-0000-0000-0000-0000000e000b', 'landing-page', 'Landing page'),
  ('00000000-0000-0000-0000-0000000e000c', 'social',       'Social'),
  ('00000000-0000-0000-0000-0000000e000d', 'pricing',      'Pricing'),
  ('00000000-0000-0000-0000-0000000e000e', 'newsletter',   'Newsletter')
on conflict (id) do nothing;

-- Tag the published feed fixtures (1–3 tags each) so every profession has ≥2 distinct
-- tags present → the landing-page filter-chip row + the tag filter have data to demo.
-- A (workflow_id, tag_slug) map joined to resolve the tag ids.
insert into public.workflow_tags (workflow_id, tag_id)
select m.workflow_id, t.id
from (values
  ('00000000-0000-0000-0000-0000000c0001'::uuid, 'landing-page'),
  ('00000000-0000-0000-0000-0000000c0001'::uuid, 'copywriting'),
  ('00000000-0000-0000-0000-0000000c0002'::uuid, 'data'),
  ('00000000-0000-0000-0000-0000000c0002'::uuid, 'dashboard'),
  ('00000000-0000-0000-0000-0000000c0002'::uuid, 'automation'),
  ('00000000-0000-0000-0000-0000000c0003'::uuid, 'video'),
  ('00000000-0000-0000-0000-0000000c0003'::uuid, 'social'),
  ('00000000-0000-0000-0000-0000000c0004'::uuid, 'icons'),
  ('00000000-0000-0000-0000-0000000c0004'::uuid, 'design'),
  ('00000000-0000-0000-0000-0000000c0004'::uuid, 'branding'),
  ('00000000-0000-0000-0000-0000000c0005'::uuid, 'email'),
  ('00000000-0000-0000-0000-0000000c0005'::uuid, 'copywriting'),
  ('00000000-0000-0000-0000-0000000c0006'::uuid, 'seo'),
  ('00000000-0000-0000-0000-0000000c0006'::uuid, 'copywriting'),
  ('00000000-0000-0000-0000-0000000c0007'::uuid, 'landing-page'),
  ('00000000-0000-0000-0000-0000000c0007'::uuid, 'pricing'),
  ('00000000-0000-0000-0000-0000000c0008'::uuid, 'newsletter'),
  ('00000000-0000-0000-0000-0000000c0008'::uuid, 'email'),
  ('00000000-0000-0000-0000-0000000c0009'::uuid, 'data'),
  ('00000000-0000-0000-0000-0000000c0009'::uuid, 'automation'),
  ('00000000-0000-0000-0000-0000000c0010'::uuid, 'video'),
  ('00000000-0000-0000-0000-0000000c0010'::uuid, 'social'),
  ('00000000-0000-0000-0000-0000000c0011'::uuid, 'icons'),
  ('00000000-0000-0000-0000-0000000c0011'::uuid, 'design'),
  ('00000000-0000-0000-0000-0000000c0012'::uuid, 'email'),
  ('00000000-0000-0000-0000-0000000c0012'::uuid, 'copywriting'),
  ('00000000-0000-0000-0000-0000000c0013'::uuid, 'design'),
  ('00000000-0000-0000-0000-0000000c0014'::uuid, 'copywriting'),
  ('00000000-0000-0000-0000-0000000c0014'::uuid, 'seo')
) as m(workflow_id, tag_slug)
join public.tags t on t.slug = m.tag_slug
on conflict (workflow_id, tag_id) do nothing;

-- Memberships. The migration's founder-as-moderator-of-all seed no-ops locally (it runs
-- during migration, BEFORE profiles seed), so re-seed it here to mirror prod + populate
-- the rail Mods card. Plus a few member joins so member_count reads realistically. The
-- sync_member_count trigger maintains professions.member_count on each insert.
insert into public.profession_members (profile_id, profession_id, role)
select '00000000-0000-0000-0000-000000000001', p.id, 'moderator'
from public.professions p
on conflict (profile_id, profession_id) do nothing;

insert into public.profession_members (profile_id, profession_id, role) values
  ('00000000-0000-0000-0000-0000000000d1', (select id from public.professions where slug = 'web-developer'),  'member'),
  ('00000000-0000-0000-0000-0000000000d1', (select id from public.professions where slug = 'content-writer'), 'member'),
  ('00000000-0000-0000-0000-0000000000d2', (select id from public.professions where slug = 'ai-automation'),  'member'),
  ('00000000-0000-0000-0000-0000000000d2', (select id from public.professions where slug = 'content-writer'), 'member'),
  ('00000000-0000-0000-0000-0000000000d3', (select id from public.professions where slug = 'video-creator'),  'member'),
  ('00000000-0000-0000-0000-0000000000d3', (select id from public.professions where slug = 'marketer'),       'member')
on conflict (profile_id, profession_id) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- Story 6.3 — Workflow of the Day. A curated feature per a few professions, dated
-- current_date so the WOTD hero renders on /explore + the community pages. curated_by =
-- the founder. (Feed fixtures not asserted by name in explore.spec.ts, so the hero never
-- collides with the trending-grid card assertions.) The read picks the most recent.
insert into public.daily_featured (feature_date, profession_id, workflow_id, curated_by)
select current_date, p.id, v.wf, '00000000-0000-0000-0000-000000000001'
from (values
  ('graphic-designer', '00000000-0000-0000-0000-0000000c0004'::uuid),
  ('ai-automation',    '00000000-0000-0000-0000-0000000c0002'::uuid),
  ('web-developer',    '00000000-0000-0000-0000-0000000c0007'::uuid)
) as v(slug, wf)
join public.professions p on p.slug = v.slug
on conflict (feature_date, profession_id) do nothing;

-- Story 7.2 — per-profession house rules (rendered in the community rail; parseHouseRules falls
-- back to the 3 universal norms when a profession's rules are empty). One craft-specific rule each
-- so the rail (and the e2e) show real per-profession content, not just the universal defaults.
update public.professions set rules = '[
  {"title":"Show real output.","body":"Every recipe needs a sample to publish."},
  {"title":"Credit your fork.","body":"Keep lineage intact when you remix."},
  {"title":"Ship the stack.","body":"Name every tool + model your recipe uses."}
]'::jsonb where slug = 'web-developer';
update public.professions set rules = '[
  {"title":"Show real output.","body":"Post the generated asset, not just the prompt."},
  {"title":"Credit your fork.","body":"Keep lineage intact when you remix."},
  {"title":"Mind the license.","body":"Flag commercial-use limits on generated art."}
]'::jsonb where slug = 'graphic-designer';
update public.professions set rules = '[
  {"title":"Show real output.","body":"Attach a sample run or export."},
  {"title":"Credit your fork.","body":"Keep lineage intact when you remix."},
  {"title":"No secrets in prompts.","body":"Redact keys + customer data from samples."}
]'::jsonb where slug = 'ai-automation';

-- Story 7.2 — mod-curated "Start here" pinned canon (founder-curated in v1; the pin/unpin UI is
-- Story 7.3). Replaces the 6.2 interim most-forked proxy. Ordered by position.
insert into public.profession_pins (profession_id, workflow_id, position)
select p.id, v.wf, v.pos
from (values
  ('web-developer',    '00000000-0000-0000-0000-0000000c0001'::uuid, 0),
  ('web-developer',    '00000000-0000-0000-0000-0000000c0007'::uuid, 1),
  ('web-developer',    '00000000-0000-0000-0000-0000000c0013'::uuid, 2),
  ('graphic-designer', '00000000-0000-0000-0000-0000000c0004'::uuid, 0),
  ('graphic-designer', '00000000-0000-0000-0000-0000000c0011'::uuid, 1),
  ('ai-automation',    '00000000-0000-0000-0000-0000000c0002'::uuid, 0),
  ('ai-automation',    '00000000-0000-0000-0000-0000000c0009'::uuid, 1)
) as v(slug, wf, pos)
join public.professions p on p.slug = v.slug
on conflict (profession_id, workflow_id) do nothing;
