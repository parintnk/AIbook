-- Owner flow — Unpublish (published -> draft). The inverse of `publish_workflow`.
--
-- ⚠️ SECURITY DEFINER for the SAME reason as publish_workflow: `status` / `published_at`
-- are revoked from `authenticated` (the 2.1 self-publish column lock), so a direct
-- PostgREST UPDATE can't flip status. This RPC is the ONLY authenticated path back to
-- 'draft'. It re-asserts owner + currently-published itself (definer bypasses RLS), then
-- sets status='draft' and clears published_at (the `workflows_published_has_ts` CHECK only
-- constrains the published side, so a null on a draft is fine; a later re-publish re-stamps
-- it). Trips the documented `authenticated_security_definer_function_executable` advisor
-- WARN, same intended exception as publish_workflow.
--
-- Forks survive: a child's parent_id keeps pointing at the now-draft row (the lineage view
-- already treats a non-published parent as a soft boundary), and republishing restores it.
-- Public feeds + semantic search both gate on status='published', so unpublishing removes it
-- from discovery immediately. RAISE 42501 on the auth/not-found failure (service → not_found).

create or replace function public.unpublish_workflow(p_workflow_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.workflows w
    where w.id = p_workflow_id
      and w.author_id = v_uid
      and w.status = 'published'
  ) then
    raise exception 'not_owner_or_not_published' using errcode = '42501';
  end if;

  update public.workflows
    set status = 'draft',
        published_at = null
  where id = p_workflow_id;
end;
$$;

revoke execute on function public.unpublish_workflow(uuid) from public, anon;
grant execute on function public.unpublish_workflow(uuid) to authenticated;
