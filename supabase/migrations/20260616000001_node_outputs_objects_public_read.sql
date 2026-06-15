-- Story 3.1 — open published-workflow media to anonymous viewers.
--
-- Story 2.4's `node_outputs_objects_select` storage policy is `for select TO
-- authenticated` (that migration's own header flagged "Epic 3 may flip serving to
-- public/long-signed at publish time"). The public detail viewer (FR6, "as a
-- visitor") serves a published workflow with NO login, so an `anon` session must be
-- able to `createSignedUrl` for that workflow's image/video/file objects. The TABLE
-- select policies (workflows/workflow_nodes/workflow_edges/node_outputs) are already
-- `to public` (published-or-author) — only this STORAGE policy excluded anon.
--
-- Recreate it for BOTH anon + authenticated with the SAME predicate. For `anon`,
-- auth.uid() is null → only the `status='published'` branch can match, so anon reads
-- published media ONLY (a draft's objects stay private). Writes (insert/update/delete)
-- are untouched: still `to authenticated`, author + draft scoped.
-- [Source: epics.md#Story-3.1 L463-473; 20260615000008_node_outputs_bucket.sql L4,L47-57]

drop policy if exists "node_outputs_objects_select" on storage.objects;
create policy "node_outputs_objects_select" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'node-outputs'
    and exists (
      select 1 from public.workflows w
      where w.id = ((storage.foldername(name))[1])::uuid
        and (w.status = 'published' or w.author_id = (select auth.uid()))
    )
  );
