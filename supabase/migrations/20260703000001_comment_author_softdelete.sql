-- Owner flows — let a comment's AUTHOR soft-delete their OWN comment.
--
-- Story 4.2 provisioned `deleted_at` + the "[comment removed]" tombstone but wired NO write
-- path: `update` is revoked from authenticated and there was no UPDATE policy (body is
-- immutable; deleted_at was reserved for moderation). Author-delete uses soft-delete on
-- purpose — a hard DELETE cascades to others' replies (parent_comment_id ... on delete
-- cascade), destroying their content; setting deleted_at keeps the thread intact and the
-- viewer already renders the tombstone.
--
-- Scope is tight: a column grant for ONLY `deleted_at` + an own-row UPDATE policy. author_id
-- stays non-grantable, so the with-check can't be spoofed and no other column is writable.

create policy "comments_softdelete_own" on public.comments
  for update using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

grant update (deleted_at) on public.comments to authenticated;
