-- Story 2.1 hardening (code-review finding) — column-level write locks on workflows.
-- RLS gates which ROWS an owner can touch; these grants gate which COLUMNS. Without
-- them an authenticated user hitting PostgREST directly (their own JWT + the public
-- anon key) could bypass the service layer to self-publish (status -> 'published',
-- published_at — bypassing the Story 2.5 real-output gate), forge the denormalized
-- ranking counters (fork_count / tried_count / worked_score), fake lineage
-- (parent_id), or spoof created_at/updated_at. Those columns are service- or
-- trigger-owned; authenticated users may only write draft metadata.
-- (Mirrors the Story 1.5 member_count column lock.)

revoke insert, update on public.workflows from anon, authenticated;
grant insert (author_id, profession_id, title, summary)
  on public.workflows to authenticated;
grant update (title, summary, profession_id)
  on public.workflows to authenticated;
