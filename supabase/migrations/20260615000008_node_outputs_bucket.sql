-- Story 2.4 — Storage bucket + storage.objects RLS for per-node sample outputs.
-- The `node-outputs` bucket is PRIVATE (public=false): outputs are draft-scoped
-- creator assets served via signed URLs (RLS-checked) until publish. Epic 3 may flip
-- serving to public/long-signed at publish time — out of scope here.
--   file_size_limit = 100MB (the video cap; the 10MB image cap is app-enforced).
--   allowed_mime_types = the binary allowlist (defense-in-depth atop the app sniff —
--   it trusts the client content-type, so it is NOT the primary gate).
-- [Source: architecture.md#DR-3 L61-64; epics.md#Story-2.4 L419-429]

-- ── Bucket (idempotent) ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'node-outputs', 'node-outputs', false, 104857600,
  array['image/png','image/jpeg','image/webp','image/gif',
        'video/mp4','video/webm','video/quicktime','application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── storage.objects RLS ─────────────────────────────────────────────────────
-- Path convention: workflow_id/node_id/<file>, so (storage.foldername(name))[1] is
-- the workflow id. Ownership is the SAME two-hop model as node_outputs, expressed on
-- the object path → workflows.author_id. Reads = published-or-mine; writes = my draft.
-- NOTE: the server upload runs under the UPLOADER'S SESSION (the publishable-key
-- server client, not the secret/service-role key), so these policies are LOAD-BEARING
-- — they are the real boundary on writes AND on signed-URL reads, not just
-- defense-in-depth. The Route Handler ALSO checks ownsDraftForNode + the node↔workflow
-- match before reading the body (early 403 + a path that always matches the row's
-- node), but do NOT remove these policies believing the upload bypasses them. Any
-- future client-direct upload is gated here too. Fail-closed: a malformed (non-uuid)
-- path errors the ::uuid cast → write denied.
drop policy if exists "node_outputs_objects_insert" on storage.objects;
create policy "node_outputs_objects_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'node-outputs'
    and exists (
      select 1 from public.workflows w
      where w.id = ((storage.foldername(name))[1])::uuid
        and w.author_id = (select auth.uid())
        and w.status = 'draft'
    )
  );

drop policy if exists "node_outputs_objects_select" on storage.objects;
create policy "node_outputs_objects_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'node-outputs'
    and exists (
      select 1 from public.workflows w
      where w.id = ((storage.foldername(name))[1])::uuid
        and (w.status = 'published' or w.author_id = (select auth.uid()))
    )
  );

drop policy if exists "node_outputs_objects_update" on storage.objects;
create policy "node_outputs_objects_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'node-outputs'
    and exists (
      select 1 from public.workflows w
      where w.id = ((storage.foldername(name))[1])::uuid
        and w.author_id = (select auth.uid()) and w.status = 'draft'
    )
  );

drop policy if exists "node_outputs_objects_delete" on storage.objects;
create policy "node_outputs_objects_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'node-outputs'
    and exists (
      select 1 from public.workflows w
      where w.id = ((storage.foldername(name))[1])::uuid
        and w.author_id = (select auth.uid()) and w.status = 'draft'
    )
  );
