-- Story 5.1 — Workflow lineage closure table (FR16 / AR4 — the remix moat).
-- A fork records its parent via workflows.parent_id (the immediate edge); this closure
-- table records the TRANSITIVE graph (ancestor → descendant + depth) so full ancestry /
-- all descendants are fetchable in ONE indexed query, no read-time recursion (architecture.md:121).
-- Maintained by a SECURITY DEFINER AFTER-INSERT trigger on `workflows`: every workflow gets a
-- self-row (id,id,0); a fork (parent_id set) inherits the parent's full ancestry at depth+1 and
-- bumps the parent's fork_count (a +1 delta on the locked row → concurrency-safe WITHOUT an
-- explicit `for update`, the 4.2 comment_likes_sync_count corollary; NOT 4.1's full-recompute).
-- The trigger fn is trigger-internal (execute revoked) → NO advisor WARN. The fork_workflow RPC
-- (next migration) is the only writer of parent_id → the only path that creates ancestry rows.
-- [Source: epics.md#Story-5.1 AC2; architecture.md:120-121,136; 4.1/4.2 ±1-vs-recompute lesson]

-- ── workflow_lineage (closure table) ────────────────────────────────────────
create table if not exists public.workflow_lineage (
  ancestor_id uuid not null references public.workflows (id) on delete cascade,
  descendant_id uuid not null references public.workflows (id) on delete cascade,
  depth smallint not null,
  constraint workflow_lineage_pkey primary key (ancestor_id, descendant_id)
);

-- Ancestry-by-descendant + descendants-by-ancestor (architecture.md:136 key indexes).
create index if not exists workflow_lineage_ancestor_idx
  on public.workflow_lineage (ancestor_id, depth);
create index if not exists workflow_lineage_descendant_idx
  on public.workflow_lineage (descendant_id);

-- ── maintain-lineage + fork_count trigger (after insert on workflows) ────────
create or replace function public.maintain_workflow_lineage()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Every workflow is its own ancestor at depth 0 (the closure-table self-row).
  insert into public.workflow_lineage (ancestor_id, descendant_id, depth)
    values (new.id, new.id, 0);

  -- A fork inherits the parent's FULL ancestry (the parent via its self-row → depth 1,
  -- grandparent → depth 2, …) and increments the parent's fork_count. The +1 delta on the
  -- row this statement locks re-reads the committed value → safe under concurrent forks
  -- WITHOUT `select … for update` (the Story 4.2 ±1 corollary; do NOT add a lock here).
  if new.parent_id is not null then
    insert into public.workflow_lineage (ancestor_id, descendant_id, depth)
      select l.ancestor_id, new.id, l.depth + 1
      from public.workflow_lineage l
      where l.descendant_id = new.parent_id;

    update public.workflows set fork_count = fork_count + 1
      where id = new.parent_id;
  end if;

  return new;
end;
$$;
revoke execute on function public.maintain_workflow_lineage() from public, anon, authenticated;

drop trigger if exists workflows_maintain_lineage on public.workflows;
create trigger workflows_maintain_lineage
  after insert on public.workflows
  for each row execute procedure public.maintain_workflow_lineage();

-- ── Symmetric fork_count decrement (after delete) ────────────────────────────
-- The ±1 INSERT increment above needs an AFTER-DELETE counterpart, else deleting a fork (e.g. a
-- creator deletes a just-created draft fork via deleteDraft) leaves the source's fork_count
-- over-counted. A draft fork is a LEAF (forking requires published → a draft has no forks), so its
-- closure rows cascade cleanly via the FKs; only the parent's counter needs the decrement.
-- security definer (fork_count is client-write-locked) + execute revoked → trigger-internal, no WARN.
create or replace function public.decrement_fork_count_on_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.parent_id is not null then
    update public.workflows set fork_count = greatest(fork_count - 1, 0)
      where id = old.parent_id;
  end if;
  return old;
end;
$$;
revoke execute on function public.decrement_fork_count_on_delete() from public, anon, authenticated;

drop trigger if exists workflows_decrement_fork_count on public.workflows;
create trigger workflows_decrement_fork_count
  after delete on public.workflows
  for each row execute procedure public.decrement_fork_count_on_delete();

-- ── Backfill self-rows for any EXISTING workflows (idempotent) ───────────────
-- On a fresh local `db reset` the table is empty here (seed runs after migrations → the trigger
-- adds those rows); on the remote (existing workflows) this adds their (id,id,0) self-rows.
-- No ancestry to backfill — no parent_id is set yet (fork isn't built).
insert into public.workflow_lineage (ancestor_id, descendant_id, depth)
  select id, id, 0 from public.workflows
  on conflict do nothing;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.workflow_lineage enable row level security;

-- Read a closure row only if its DESCENDANT is visible to you (published, or your own draft).
-- → a stranger's PRIVATE draft fork of a public workflow is never leaked; published ancestry
-- and my own forks are readable. (Story 5.3 reads this for the tree; the joined ancestor
-- workflows are gated separately by the workflows RLS.)
create policy "workflow_lineage_select" on public.workflow_lineage
  for select using (
    exists (
      select 1 from public.workflows w
      where w.id = descendant_id
        and (w.status = 'published' or w.author_id = (select auth.uid()))
    )
  );

-- No client writes — only the definer trigger maintains the closure table.
revoke insert, update, delete on public.workflow_lineage from anon, authenticated;
