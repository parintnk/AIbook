-- Story 6.2 — Tags taxonomy for workflow discovery / filtering.
-- tags (curated, seeded) + workflow_tags (M2M join) + RLS. Powers the profession
-- landing page's tag-filter chips (FR3) and, later, semantic+tag search (FR2, Epic 10).
-- Authors pick from the curated tag set; they attach/detach tags on their own
-- workflows. No tag column on `workflows` — filtering goes through `workflow_tags`.
-- [Source: epics.md#Story 6.2: Profession landing page (AC1 "filterable by tag"); prd.md:91-92 FR2/FR3]

-- ── Tables ────────────────────────────────────────────────────────────────
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_tags (
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (workflow_id, tag_id)
);

-- The filter reads "which workflows carry tag X" → index by tag_id. The PK
-- (workflow_id, tag_id) already covers "tags of workflow Y" (prefix lookup).
create index if not exists workflow_tags_tag_idx
  on public.workflow_tags (tag_id);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.tags enable row level security;

-- Tags are public-readable; curated / seeded (no client writes) — service_role
-- only, mirroring the professions posture. Authors choose from existing tags.
create policy "tags_select_all" on public.tags
  for select using (true);

alter table public.workflow_tags enable row level security;

-- Public-readable so the profession-feed tag chips + the tag filter work for an
-- anonymous visitor (the feed itself is RLS-only published, no auth gate).
create policy "workflow_tags_select_all" on public.workflow_tags
  for select using (true);
-- The workflow's AUTHOR manages its tags (insert / delete join rows); no UPDATE
-- (tagging is add/remove). Mirrors the self-join / self-leave membership pattern.
-- `(select auth.uid())` is wrapped so the planner caches it (avoids the
-- auth_rls_initplan advisor warning), exactly like the professions policies.
create policy "workflow_tags_author_insert" on public.workflow_tags
  for insert with check (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_id and w.author_id = (select auth.uid())
    )
  );
create policy "workflow_tags_author_delete" on public.workflow_tags
  for delete using (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_id and w.author_id = (select auth.uid())
    )
  );
