-- ============================================================================
-- REMOTE DEMO SEED — applied to the hosted project (drfvxecwgwvissuweaah) via the
-- Supabase MCP, NOT part of `db reset` (that runs seed.sql, the local/e2e fixture).
-- Purpose: make the PRODUCTION UI vivid (Explore feed, profession communities,
-- detail trust rows, comments, lineage) — the hosted DB otherwise has 0 published
-- workflows / 0 tags.
--
-- SAFETY
-- - Does NOT touch the 4 real Google-auth users (parintnk / grayzoneno13 / folkparin
--   / brockwray1111) nor their drafts. parintnk stays moderator-of-all (unchanged).
-- - All demo rows use DISTINCT uuid ranges: users a000…, workflows b000…, nodes
--   c000…, comments e000…; tags reuse the local-seed …0e00NN ids for consistency.
-- - Every insert is `on conflict do nothing` → re-runnable / idempotent.
-- - NO outcome_votes are inserted (the recompute trigger would set worked_score to a
--   weighted COUNT — the logged Epic-4 launch bug). Instead the trust counters are
--   set directly as a 0–1 RATIO (forward-compatible with the eventual ratio fix).
-- - Demo authors are fake (handles derived from @example.com by the on_auth_user
--   _created trigger); avatars are pravatar.cc (graceful initials fallback on error).
-- ============================================================================

-- ── Demo author users (8) ───────────────────────────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000001','authenticated','authenticated','alexrivera@example.com',  now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000002','authenticated','authenticated','miachen@example.com',     now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000003','authenticated','authenticated','diegosantos@example.com', now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000004','authenticated','authenticated','saraokafor@example.com',  now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000005','authenticated','authenticated','tombecker@example.com',   now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000006','authenticated','authenticated','linapark@example.com',    now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000007','authenticated','authenticated','noahkim@example.com',     now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','','','',''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-4000-8000-000000000008','authenticated','authenticated','yukitanaka@example.com',  now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','','','','')
on conflict (id) do nothing;

-- Profile polish (the on_auth_user_created trigger already made the rows + handles).
update public.profiles set display_name='Alex Rivera',  bio='Brand & icon systems. I turn one-line briefs into cohesive visual kits.', avatar_url='https://i.pravatar.cc/240?img=12', primary_profession_id=(select id from public.professions where slug='graphic-designer') where handle='alexrivera';
update public.profiles set display_name='Mia Chen',     bio='Automation tinkerer. Messy CSV in, board-ready dashboard out.',           avatar_url='https://i.pravatar.cc/240?img=5',  primary_profession_id=(select id from public.professions where slug='ai-automation')    where handle='miachen';
update public.profiles set display_name='Diego Santos',  bio='Short-form video. Hooks, cuts, captions — fast.',                          avatar_url='https://i.pravatar.cc/240?img=14', primary_profession_id=(select id from public.professions where slug='video-creator')    where handle='diegosantos';
update public.profiles set display_name='Sara Okafor',   bio='Long-form & SEO. Words that rank and actually read well.',                avatar_url='https://i.pravatar.cc/240?img=9',  primary_profession_id=(select id from public.professions where slug='content-writer')   where handle='saraokafor';
update public.profiles set display_name='Tom Becker',    bio='Frontend + LLMs. Landing pages and typed endpoints, shipped today.',      avatar_url='https://i.pravatar.cc/240?img=33', primary_profession_id=(select id from public.professions where slug='web-developer')     where handle='tombecker';
update public.profiles set display_name='Lina Park',     bio='Lifecycle & launch email. Sequences that convert.',                       avatar_url='https://i.pravatar.cc/240?img=16', primary_profession_id=(select id from public.professions where slug='marketer')         where handle='linapark';
update public.profiles set display_name='Noah Kim',      bio='Full-stack. Component-library audits & pragmatic cleanups.',              avatar_url='https://i.pravatar.cc/240?img=51', primary_profession_id=(select id from public.professions where slug='web-developer')     where handle='noahkim';
update public.profiles set display_name='Yuki Tanaka',   bio='Product & app iconography. One concept, every platform size.',           avatar_url='https://i.pravatar.cc/240?img=26', primary_profession_id=(select id from public.professions where slug='graphic-designer')  where handle='yukitanaka';

-- ── Tags (reuse local-seed ids for local↔remote consistency) ─────────────────
insert into public.tags (id, slug, label) values
  ('00000000-0000-0000-0000-0000000e0001','automation','Automation'),
  ('00000000-0000-0000-0000-0000000e0002','design','Design'),
  ('00000000-0000-0000-0000-0000000e0003','branding','Branding'),
  ('00000000-0000-0000-0000-0000000e0004','copywriting','Copywriting'),
  ('00000000-0000-0000-0000-0000000e0005','video','Video'),
  ('00000000-0000-0000-0000-0000000e0006','data','Data'),
  ('00000000-0000-0000-0000-0000000e0007','seo','SEO'),
  ('00000000-0000-0000-0000-0000000e0008','email','Email'),
  ('00000000-0000-0000-0000-0000000e0009','icons','Icons'),
  ('00000000-0000-0000-0000-0000000e000a','dashboard','Dashboard'),
  ('00000000-0000-0000-0000-0000000e000b','landing-page','Landing page'),
  ('00000000-0000-0000-0000-0000000e000c','social','Social'),
  ('00000000-0000-0000-0000-0000000e000d','pricing','Pricing'),
  ('00000000-0000-0000-0000-0000000e000e','newsletter','Newsletter')
on conflict (id) do nothing;

-- ── 24 published workflows (4 per profession) ────────────────────────────────
-- worked_count/tweaked_count/failed_count set here; tried_count + worked_score
-- (a 0–1 ratio) are derived in the FINAL UPDATE below.
insert into public.workflows
  (id, author_id, profession_id, title, summary, status, published_at, last_verified_at, fork_count, worked_count, tweaked_count, failed_count)
values
  -- graphic-designer
  ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',(select id from public.professions where slug='graphic-designer'),'Cohesive 24-icon set from one style ref','Generate a consistent icon family from a single style reference.','published',now()-interval '3 days', now()-interval '3 days', 142, 33, 4, 1),
  ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000008',(select id from public.professions where slug='graphic-designer'),'App icon in 6 platform sizes, one pass','One concept exported to every platform icon size in a single pass.','published',now()-interval '6 days', now()-interval '6 days', 61, 20, 1, 1),
  ('b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001',(select id from public.professions where slug='graphic-designer'),'Brand kit from a one-paragraph brief','Logo direction, palette, and type pairing from a short written brief.','published',now()-interval '1 day', now()-interval '1 day', 233, 47, 3, 1),
  ('b0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000008',(select id from public.professions where slug='graphic-designer'),'Social templates that stay on-brand','A pack of post templates locked to your brand tokens.','published',now()-interval '9 days', now()-interval '9 days', 39, 14, 2, 1),
  -- ai-automation
  ('b0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000002',(select id from public.professions where slug='ai-automation'),'Revenue dashboard from a raw CSV export','Clean, join, and chart a messy export into a board-ready dashboard.','published',now()-interval '7 hours', now()-interval '7 hours', 264, 30, 2, 1),
  ('b0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000002',(select id from public.professions where slug='ai-automation'),'Churn cohort heatmap from a Stripe export','Bucket customers into cohorts and chart retention from an export.','published',now()-interval '4 days', now()-interval '4 days', 88, 9, 1, 1),
  ('b0000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000002',(select id from public.professions where slug='ai-automation'),'Inbox triage agent for support','Route, tag, and draft replies for an overflowing support inbox.','published',now()-interval '2 days', now()-interval '2 days', 130, 24, 2, 0),
  ('b0000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000005',(select id from public.professions where slug='ai-automation'),'Weekly metrics digest to Slack','Pull the KPIs and post a formatted digest every Monday morning.','published',now()-interval '5 days', now()-interval '5 days', 74, 17, 1, 0),
  -- video-creator
  ('b0000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-000000000003',(select id from public.professions where slug='video-creator'),'YouTube short from a blog post in 6 cuts','Cut a long-form post into a punchy vertical short with captions.','published',now()-interval '1 day', now()-interval '1 day', 198, 25, 2, 1),
  ('b0000000-0000-4000-8000-00000000000a','a0000000-0000-4000-8000-000000000003',(select id from public.professions where slug='video-creator'),'Podcast clip pack — 8 vertical highlights','Find the hooks and cut eight share-ready vertical clips.','published',now()-interval '5 days', now()-interval '5 days', 76, 6, 1, 0),
  ('b0000000-0000-4000-8000-00000000000b','a0000000-0000-4000-8000-000000000003',(select id from public.professions where slug='video-creator'),'Auto-captions + B-roll suggestions','Caption a talking-head cut and suggest B-roll for each line.','published',now()-interval '8 days', now()-interval '8 days', 52, 12, 2, 0),
  ('b0000000-0000-4000-8000-00000000000c','a0000000-0000-4000-8000-000000000003',(select id from public.professions where slug='video-creator'),'Faceless explainer from a script','Turn a written script into a narrated, faceless explainer video.','published',now()-interval '3 days', now()-interval '3 days', 109, 19, 2, 1),
  -- content-writer
  ('b0000000-0000-4000-8000-00000000000d','a0000000-0000-4000-8000-000000000004',(select id from public.professions where slug='content-writer'),'SEO blog draft from a keyword + outline','A search-tuned draft from a target keyword and a rough outline.','published',now()-interval '2 days', now()-interval '2 days', 129, 23, 1, 1),
  ('b0000000-0000-4000-8000-00000000000e','a0000000-0000-4000-8000-000000000004',(select id from public.professions where slug='content-writer'),'Case study from a customer interview','Shape a raw interview transcript into a polished case study.','published',now()-interval '12 days', now()-interval '12 days', 41, 8, 1, 0),
  ('b0000000-0000-4000-8000-00000000000f','a0000000-0000-4000-8000-000000000004',(select id from public.professions where slug='content-writer'),'Newsletter from this week''s commits','Turn a week of git history into a friendly product newsletter.','published',now()-interval '3 days', now()-interval '3 days', 96, 11, 1, 1),
  ('b0000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000004',(select id from public.professions where slug='content-writer'),'Repurpose one post into 5 channels','Spin a single article into LinkedIn, X, Instagram, and email.','published',now()-interval '6 days', now()-interval '6 days', 83, 16, 2, 0),
  -- web-developer
  ('b0000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000005',(select id from public.professions where slug='web-developer'),'SaaS landing page from a one-line brief','Turn a single sentence into a full, sectioned landing page.','published',now()-interval '2 hours', now()-interval '2 hours', 312, 38, 1, 1),
  ('b0000000-0000-4000-8000-000000000012','a0000000-0000-4000-8000-000000000007',(select id from public.professions where slug='web-developer'),'Pricing page A/B variants in one prompt','Two distinct pricing-page directions to test from one prompt.','published',now()-interval '3 days', now()-interval '3 days', 118, 12, 1, 1),
  ('b0000000-0000-4000-8000-000000000013','a0000000-0000-4000-8000-000000000007',(select id from public.professions where slug='web-developer'),'Component library audit + cleanup plan','Audit a component library and produce a prioritised cleanup plan.','published',now()-interval '10 days', now()-interval '10 days', 30, 6, 1, 1),
  ('b0000000-0000-4000-8000-000000000014','a0000000-0000-4000-8000-000000000005',(select id from public.professions where slug='web-developer'),'REST endpoint from a plain-English spec','Generate a typed endpoint plus tests from a plain description.','published',now()-interval '4 days', now()-interval '4 days', 67, 15, 1, 0),
  -- marketer
  ('b0000000-0000-4000-8000-000000000015','a0000000-0000-4000-8000-000000000006',(select id from public.professions where slug='marketer'),'Launch email sequence from a product brief','A five-email launch sequence drafted from one product brief.','published',now()-interval '2 days', now()-interval '2 days', 141, 17, 1, 1),
  ('b0000000-0000-4000-8000-000000000016','a0000000-0000-4000-8000-000000000006',(select id from public.professions where slug='marketer'),'Cold-email sequence that books demos','A four-touch cold sequence tuned to book qualified demos.','published',now()-interval '8 days', now()-interval '8 days', 44, 4, 1, 1),
  ('b0000000-0000-4000-8000-000000000017','a0000000-0000-4000-8000-000000000006',(select id from public.professions where slug='marketer'),'Ad angles + hooks from a value prop','Twelve ad angles and scroll-stopping hooks from one value prop.','published',now()-interval '1 day', now()-interval '1 day', 88, 21, 2, 0),
  ('b0000000-0000-4000-8000-000000000018','a0000000-0000-4000-8000-000000000006',(select id from public.professions where slug='marketer'),'Landing copy that matches ad intent','Message-match landing-page copy to each ad set automatically.','published',now()-interval '6 days', now()-interval '6 days', 35, 10, 1, 1)
on conflict (id) do nothing;

-- ── Fork-chain (lineage demo) — graphic-designer; insert root→child→grandchild
-- in order so the maintain_workflow_lineage trigger builds the closure + fork_count.
insert into public.workflows (id, author_id, profession_id, title, summary, status, published_at, last_verified_at, worked_count, tweaked_count, failed_count)
values ('b0000000-0000-4000-8000-0000000000f1','a0000000-0000-4000-8000-000000000001',(select id from public.professions where slug='graphic-designer'),'Brand kit — origin recipe','The original multi-tool brand-kit recipe that others forked and adapted.','published',now()-interval '24 days', now()-interval '24 days', 44, 3, 2)
on conflict (id) do nothing;

insert into public.workflows (id, author_id, profession_id, title, summary, status, parent_id, published_at, last_verified_at, worked_count, tweaked_count, failed_count)
values ('b0000000-0000-4000-8000-0000000000f2','a0000000-0000-4000-8000-000000000008',(select id from public.professions where slug='graphic-designer'),'Café rebrand — pastel fork','A softer, pastel-leaning fork of the origin brand kit.','published','b0000000-0000-4000-8000-0000000000f1',now()-interval '12 days', now()-interval '12 days', 13, 1, 0)
on conflict (id) do nothing;

insert into public.workflows (id, author_id, profession_id, title, summary, status, parent_id, published_at, last_verified_at, worked_count, tweaked_count, failed_count)
values ('b0000000-0000-4000-8000-0000000000f3','a0000000-0000-4000-8000-000000000002',(select id from public.professions where slug='graphic-designer'),'Matcha café kit','A matcha-shop spin forked from the pastel rebrand.','published','b0000000-0000-4000-8000-0000000000f2',now()-interval '4 days', now()-interval '4 days', 7, 1, 0)
on conflict (id) do nothing;

-- ── Nodes (1 per workflow; the fork origin gets 3 for a richer detail/canvas) ──
insert into public.workflow_nodes (id, workflow_id, idx, pos_x, pos_y, step_title, tool_name, prompt, purpose, est_time, est_cost)
values
  ('c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001',0,0,0,'Generate the icon family','Midjourney','Generate 24 icons in one consistent line-weight style from this reference','Produce a cohesive icon set','~10 min','$0.40'),
  ('c0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002',0,0,0,'Export every platform size','Figma AI','Export the chosen icon to all iOS/Android/web sizes','Produce platform-ready icons','~5 min','$0'),
  ('c0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000003',0,0,0,'Draft the brand direction','ChatGPT','Propose a logo direction, palette, and type pairing from this brief','Set the visual direction','~6 min','$0.02'),
  ('c0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000004',0,0,0,'Build the template pack','Canva AI','Generate post templates locked to these brand colors and fonts','Produce on-brand templates','~8 min','$0'),
  ('c0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000005',0,0,0,'Clean and chart the export','Claude','Clean, join, and chart this CSV into a board-ready dashboard','Build the dashboard','~12 min','$0.05'),
  ('c0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000006',0,0,0,'Bucket cohorts + retention','Claude','Bucket customers into monthly cohorts and chart retention','Build the heatmap','~10 min','$0.05'),
  ('c0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000007',0,0,0,'Triage and draft replies','ChatGPT','Classify, tag, and draft a reply for each support email','Clear the inbox','~7 min','$0.03'),
  ('c0000000-0000-4000-8000-000000000008','b0000000-0000-4000-8000-000000000008',0,0,0,'Compose the weekly digest','Claude','Pull the KPIs and format a Monday Slack digest','Ship the digest','~5 min','$0.02'),
  ('c0000000-0000-4000-8000-000000000009','b0000000-0000-4000-8000-000000000009',0,0,0,'Cut the vertical short','Descript','Cut the post into a 45s vertical short with captions','Produce the short','~15 min','$0'),
  ('c0000000-0000-4000-8000-00000000000a','b0000000-0000-4000-8000-00000000000a',0,0,0,'Find hooks, cut clips','Opus Clip','Find the strongest hooks and cut eight vertical clips','Produce the clip pack','~12 min','$0'),
  ('c0000000-0000-4000-8000-00000000000b','b0000000-0000-4000-8000-00000000000b',0,0,0,'Caption + suggest B-roll','Descript','Caption the cut and suggest B-roll for each line','Enrich the edit','~9 min','$0'),
  ('c0000000-0000-4000-8000-00000000000c','b0000000-0000-4000-8000-00000000000c',0,0,0,'Narrate the explainer','ElevenLabs','Narrate this script and assemble a faceless explainer','Produce the explainer','~14 min','$0.10'),
  ('c0000000-0000-4000-8000-00000000000d','b0000000-0000-4000-8000-00000000000d',0,0,0,'Write the SEO draft','ChatGPT','Write a search-tuned draft from this keyword and outline','Produce the draft','~8 min','$0.03'),
  ('c0000000-0000-4000-8000-00000000000e','b0000000-0000-4000-8000-00000000000e',0,0,0,'Shape the case study','Claude','Shape this interview transcript into a structured case study','Produce the case study','~10 min','$0.04'),
  ('c0000000-0000-4000-8000-00000000000f','b0000000-0000-4000-8000-00000000000f',0,0,0,'Draft the newsletter','Claude','Summarise this week''s commits into a friendly newsletter','Write the newsletter','~6 min','$0.02'),
  ('c0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000010',0,0,0,'Repurpose to 5 channels','ChatGPT','Spin this article into LinkedIn, X, IG, and an email','Produce the variants','~7 min','$0.03'),
  ('c0000000-0000-4000-8000-000000000011','b0000000-0000-4000-8000-000000000011',0,0,0,'Draft the landing page','ChatGPT','Draft a sectioned landing page from this one-line brief','Produce the page','~6 min','$0.02'),
  ('c0000000-0000-4000-8000-000000000012','b0000000-0000-4000-8000-000000000012',0,0,0,'Draft two pricing variants','ChatGPT','Draft two distinct pricing-page directions to A/B test','Produce the variants','~5 min','$0.02'),
  ('c0000000-0000-4000-8000-000000000013','b0000000-0000-4000-8000-000000000013',0,0,0,'Audit the component library','Claude','Audit this component library and produce a cleanup plan','Produce the plan','~12 min','$0.05'),
  ('c0000000-0000-4000-8000-000000000014','b0000000-0000-4000-8000-000000000014',0,0,0,'Generate the endpoint','Claude','Generate a typed REST endpoint plus tests from this spec','Produce the endpoint','~8 min','$0.04'),
  ('c0000000-0000-4000-8000-000000000015','b0000000-0000-4000-8000-000000000015',0,0,0,'Draft the launch sequence','ChatGPT','Draft a five-email launch sequence from this product brief','Write the sequence','~7 min','$0.03'),
  ('c0000000-0000-4000-8000-000000000016','b0000000-0000-4000-8000-000000000016',0,0,0,'Draft the cold sequence','ChatGPT','Draft a four-touch cold sequence tuned to book demos','Write the sequence','~6 min','$0.02'),
  ('c0000000-0000-4000-8000-000000000017','b0000000-0000-4000-8000-000000000017',0,0,0,'Generate ad angles','ChatGPT','Generate twelve ad angles and hooks from this value prop','Produce the angles','~5 min','$0.02'),
  ('c0000000-0000-4000-8000-000000000018','b0000000-0000-4000-8000-000000000018',0,0,0,'Match landing to ad intent','Claude','Write landing copy message-matched to each ad set','Produce the copy','~6 min','$0.03'),
  -- fork-origin: 3 nodes
  ('c0000000-0000-4000-8000-000000000031','b0000000-0000-4000-8000-0000000000f1',0,0,0,'Define the direction','ChatGPT','Define a warm, artisanal brand direction from the brief','Set the direction','~6 min','$0.02'),
  ('c0000000-0000-4000-8000-000000000032','b0000000-0000-4000-8000-0000000000f1',1,360,40,'Generate logo concepts','Midjourney','Generate four logo concepts from the brief','Produce candidate logos','~10 min','$0.40'),
  ('c0000000-0000-4000-8000-000000000033','b0000000-0000-4000-8000-0000000000f1',2,720,80,'Assemble the kit','Figma AI','Lay out the palette, type, and logo into a one-page kit','Assemble the brand kit','~8 min','$0'),
  ('c0000000-0000-4000-8000-000000000034','b0000000-0000-4000-8000-0000000000f2',0,0,0,'Shift to pastels','ChatGPT','Shift the palette to soft pastels and re-pair the type','Rework the direction','~5 min','$0.02'),
  ('c0000000-0000-4000-8000-000000000035','b0000000-0000-4000-8000-0000000000f3',0,0,0,'Matcha brand marks','Midjourney','Generate matcha-themed brand marks from the pastel kit','Produce candidate logos','~10 min','$0.40')
on conflict (id) do nothing;

-- ── Node outputs (text → text_content; binary → placeholder storage_path) ─────
insert into public.node_outputs (node_id, kind, storage_path, text_content, mime, bytes)
values
  ('c0000000-0000-4000-8000-000000000001','image','seed/b001/icons.webp',  null, 'image/webp', 204800),
  ('c0000000-0000-4000-8000-000000000002','image','seed/b002/icon.webp',   null, 'image/webp', 153600),
  ('c0000000-0000-4000-8000-000000000003','text', null, 'Direction: warm, artisanal, minimalist. Palette: espresso, cream, sage.', null, null),
  ('c0000000-0000-4000-8000-000000000004','image','seed/b004/templates.webp', null, 'image/webp', 256000),
  ('c0000000-0000-4000-8000-000000000005','file', 'seed/b005/dashboard.csv', null, 'text/csv', 51200),
  ('c0000000-0000-4000-8000-000000000006','file', 'seed/b006/cohorts.csv',   null, 'text/csv', 40960),
  ('c0000000-0000-4000-8000-000000000007','text', null, 'Each email tagged + a drafted reply, ready to review and send.', null, null),
  ('c0000000-0000-4000-8000-000000000008','text', null, 'Monday digest: MRR, signups, churn, top tickets — one Slack block.', null, null),
  ('c0000000-0000-4000-8000-000000000009','video','seed/b009/short.mp4', null, 'video/mp4', 2048000),
  ('c0000000-0000-4000-8000-00000000000a','video','seed/b00a/clips.mp4', null, 'video/mp4', 3072000),
  ('c0000000-0000-4000-8000-00000000000b','video','seed/b00b/captioned.mp4', null, 'video/mp4', 2560000),
  ('c0000000-0000-4000-8000-00000000000c','video','seed/b00c/explainer.mp4', null, 'video/mp4', 4096000),
  ('c0000000-0000-4000-8000-00000000000d','text', null, 'An H1, intro, five sections, and a meta description — search-tuned.', null, null),
  ('c0000000-0000-4000-8000-00000000000e','text', null, 'A 900-word case study with a results callout and a pull quote.', null, null),
  ('c0000000-0000-4000-8000-00000000000f','text', null, 'A six-paragraph product newsletter written from the week''s diffs.', null, null),
  ('c0000000-0000-4000-8000-000000000010','text', null, 'One article → a LinkedIn post, three tweets, an IG caption, an email.', null, null),
  ('c0000000-0000-4000-8000-000000000011','text', null, 'A sectioned hero + features + social proof + pricing + CTA page.', null, null),
  ('c0000000-0000-4000-8000-000000000012','text', null, 'Variant A (value-first) and Variant B (savings-first) pricing pages.', null, null),
  ('c0000000-0000-4000-8000-000000000013','file', 'seed/b013/audit.pdf', null, 'application/pdf', 153600),
  ('c0000000-0000-4000-8000-000000000014','text', null, 'A typed Express handler + Zod schema + three Vitest cases.', null, null),
  ('c0000000-0000-4000-8000-000000000015','text', null, 'Email 1–5: tease, value, proof, offer, last call.', null, null),
  ('c0000000-0000-4000-8000-000000000016','text', null, 'Touch 1–4: hook, value, social proof, soft ask for a demo.', null, null),
  ('c0000000-0000-4000-8000-000000000017','text', null, 'Twelve angles: pain, outcome, proof, curiosity — with hooks.', null, null),
  ('c0000000-0000-4000-8000-000000000018','text', null, 'Per-ad-set landing copy that mirrors each promise and keyword.', null, null),
  ('c0000000-0000-4000-8000-000000000031','text', null, 'Direction: warm, artisanal, minimalist.', null, null),
  ('c0000000-0000-4000-8000-000000000032','image','seed/bf1/logos.webp', null, 'image/webp', 204800),
  ('c0000000-0000-4000-8000-000000000033','image','seed/bf1/kit.webp', null, 'image/webp', 256000),
  ('c0000000-0000-4000-8000-000000000034','text', null, 'Palette: soft sage, blush, cream. Type: humanist sans + serif.', null, null),
  ('c0000000-0000-4000-8000-000000000035','image','seed/bf3/marks.webp', null, 'image/webp', 204800)
on conflict (node_id) do nothing;

-- ── workflow_tags (1–3 per workflow; every profession ≥2 distinct tags) ───────
insert into public.workflow_tags (workflow_id, tag_id)
select m.workflow_id, t.id
from (values
  ('b0000000-0000-4000-8000-000000000001'::uuid,'icons'),       ('b0000000-0000-4000-8000-000000000001'::uuid,'design'),
  ('b0000000-0000-4000-8000-000000000002'::uuid,'icons'),       ('b0000000-0000-4000-8000-000000000002'::uuid,'design'),
  ('b0000000-0000-4000-8000-000000000003'::uuid,'branding'),    ('b0000000-0000-4000-8000-000000000003'::uuid,'design'),
  ('b0000000-0000-4000-8000-000000000004'::uuid,'design'),      ('b0000000-0000-4000-8000-000000000004'::uuid,'social'),
  ('b0000000-0000-4000-8000-000000000005'::uuid,'data'),        ('b0000000-0000-4000-8000-000000000005'::uuid,'dashboard'), ('b0000000-0000-4000-8000-000000000005'::uuid,'automation'),
  ('b0000000-0000-4000-8000-000000000006'::uuid,'data'),        ('b0000000-0000-4000-8000-000000000006'::uuid,'automation'),
  ('b0000000-0000-4000-8000-000000000007'::uuid,'automation'),  ('b0000000-0000-4000-8000-000000000007'::uuid,'email'),
  ('b0000000-0000-4000-8000-000000000008'::uuid,'automation'),  ('b0000000-0000-4000-8000-000000000008'::uuid,'data'),
  ('b0000000-0000-4000-8000-000000000009'::uuid,'video'),       ('b0000000-0000-4000-8000-000000000009'::uuid,'social'),
  ('b0000000-0000-4000-8000-00000000000a'::uuid,'video'),       ('b0000000-0000-4000-8000-00000000000a'::uuid,'social'),
  ('b0000000-0000-4000-8000-00000000000b'::uuid,'video'),
  ('b0000000-0000-4000-8000-00000000000c'::uuid,'video'),       ('b0000000-0000-4000-8000-00000000000c'::uuid,'social'),
  ('b0000000-0000-4000-8000-00000000000d'::uuid,'seo'),         ('b0000000-0000-4000-8000-00000000000d'::uuid,'copywriting'),
  ('b0000000-0000-4000-8000-00000000000e'::uuid,'copywriting'),
  ('b0000000-0000-4000-8000-00000000000f'::uuid,'newsletter'),  ('b0000000-0000-4000-8000-00000000000f'::uuid,'email'),
  ('b0000000-0000-4000-8000-000000000010'::uuid,'copywriting'), ('b0000000-0000-4000-8000-000000000010'::uuid,'social'),
  ('b0000000-0000-4000-8000-000000000011'::uuid,'landing-page'),('b0000000-0000-4000-8000-000000000011'::uuid,'copywriting'),
  ('b0000000-0000-4000-8000-000000000012'::uuid,'landing-page'),('b0000000-0000-4000-8000-000000000012'::uuid,'pricing'),
  ('b0000000-0000-4000-8000-000000000013'::uuid,'design'),
  ('b0000000-0000-4000-8000-000000000014'::uuid,'automation'),
  ('b0000000-0000-4000-8000-000000000015'::uuid,'email'),       ('b0000000-0000-4000-8000-000000000015'::uuid,'copywriting'),
  ('b0000000-0000-4000-8000-000000000016'::uuid,'email'),
  ('b0000000-0000-4000-8000-000000000017'::uuid,'copywriting'), ('b0000000-0000-4000-8000-000000000017'::uuid,'social'),
  ('b0000000-0000-4000-8000-000000000018'::uuid,'landing-page'),('b0000000-0000-4000-8000-000000000018'::uuid,'copywriting'),
  ('b0000000-0000-4000-8000-0000000000f1'::uuid,'branding'),    ('b0000000-0000-4000-8000-0000000000f1'::uuid,'design'),
  ('b0000000-0000-4000-8000-0000000000f2'::uuid,'branding'),    ('b0000000-0000-4000-8000-0000000000f2'::uuid,'design'),
  ('b0000000-0000-4000-8000-0000000000f3'::uuid,'branding'),    ('b0000000-0000-4000-8000-0000000000f3'::uuid,'design')
) as m(workflow_id, tag_slug)
join public.tags t on t.slug = m.tag_slug
on conflict (workflow_id, tag_id) do nothing;

-- ── Memberships (demo authors join professions; member_count bumped below) ────
insert into public.profession_members (profile_id, profession_id, role)
select u.uid, p.id, 'member'
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid,'graphic-designer'), ('a0000000-0000-4000-8000-000000000001'::uuid,'marketer'),
  ('a0000000-0000-4000-8000-000000000002'::uuid,'ai-automation'),    ('a0000000-0000-4000-8000-000000000002'::uuid,'content-writer'), ('a0000000-0000-4000-8000-000000000002'::uuid,'web-developer'),
  ('a0000000-0000-4000-8000-000000000003'::uuid,'video-creator'),    ('a0000000-0000-4000-8000-000000000003'::uuid,'marketer'),
  ('a0000000-0000-4000-8000-000000000004'::uuid,'content-writer'),   ('a0000000-0000-4000-8000-000000000004'::uuid,'ai-automation'),
  ('a0000000-0000-4000-8000-000000000005'::uuid,'web-developer'),    ('a0000000-0000-4000-8000-000000000005'::uuid,'ai-automation'),
  ('a0000000-0000-4000-8000-000000000006'::uuid,'marketer'),         ('a0000000-0000-4000-8000-000000000006'::uuid,'content-writer'), ('a0000000-0000-4000-8000-000000000006'::uuid,'video-creator'),
  ('a0000000-0000-4000-8000-000000000007'::uuid,'web-developer'),    ('a0000000-0000-4000-8000-000000000007'::uuid,'graphic-designer'),
  ('a0000000-0000-4000-8000-000000000008'::uuid,'graphic-designer'), ('a0000000-0000-4000-8000-000000000008'::uuid,'web-developer')
) as u(uid, slug)
join public.professions p on p.slug = u.slug
on conflict (profile_id, profession_id) do nothing;

-- ── Comments (a few alive threads on the popular workflows; replies + likes) ──
insert into public.comments (id, workflow_id, author_id, parent_comment_id, body, like_count, created_at) values
  ('e0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000002',null,'Used this for a client microsite — shipped in an afternoon. 🔥', 7, now()-interval '20 hours'),
  ('e0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000005','e0000000-0000-4000-8000-000000000001','Glad it helped! Tip: paste your value prop first, the sections come out tighter.', 3, now()-interval '16 hours'),
  ('e0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000004',null,'The section order is chef''s kiss. Stole it for a pitch page.', 2, now()-interval '8 hours'),
  ('e0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000006',null,'Saved me from a weekend of spreadsheet hell. 🙏', 5, now()-interval '2 days'),
  ('e0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000003',null,'Does this handle multi-currency exports?', 1, now()-interval '1 day'),
  ('e0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000005','Yep — add a currency column and step 1 groups by it automatically.', 4, now()-interval '20 hours'),
  ('e0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000008',null,'Forked this for a bakery brand, worked great with two tweaks.', 6, now()-interval '1 day'),
  ('e0000000-0000-4000-8000-000000000008','b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000007','Love seeing the forks 🙌 drop the link!', 2, now()-interval '18 hours')
on conflict (id) do nothing;

-- ── FINAL: derive tried_count + worked_score (0–1 ratio) for the demo workflows;
-- bump member_count to vivid community numbers (vanity; the ±1 join trigger rides
-- on top of these, so a real join/leave still nudges correctly).
update public.workflows
set tried_count = worked_count + tweaked_count + failed_count,
    worked_score = round(
      (worked_count + 0.5 * tweaked_count)::numeric
      / greatest(worked_count + tweaked_count + failed_count, 1), 2)
where id::text like 'b0000000-0000-4000-8000-%';

update public.professions set member_count = case slug
  when 'ai-automation'    then 156
  when 'web-developer'    then 203
  when 'graphic-designer' then 128
  when 'content-writer'   then 94
  when 'video-creator'    then 112
  when 'marketer'         then 87
  else member_count end
where slug in ('ai-automation','web-developer','graphic-designer','content-writer','video-creator','marketer');

-- ── Story 6.3: Workflow of the Day (current_date features → the WOTD hero on production)
-- curated_by resolves the founder by a stable handle (NOT a raw uuid) so a re-run on a
-- fresh / branch DB without that profile yields a null curator instead of a FK-abort.
insert into public.daily_featured (feature_date, profession_id, workflow_id, curated_by)
select current_date, p.id, v.wf, (select id from public.profiles where handle = 'parintnk')
from (values
  ('graphic-designer', 'b0000000-0000-4000-8000-000000000001'::uuid),
  ('web-developer',    'b0000000-0000-4000-8000-000000000011'::uuid),
  ('ai-automation',    'b0000000-0000-4000-8000-000000000005'::uuid)
) as v(slug, wf)
join public.professions p on p.slug = v.slug
on conflict (feature_date, profession_id) do nothing;
