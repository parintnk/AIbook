import "server-only";
import { cache } from "react";
import type { LineageNode } from "@/lib/lineage";
import { createClient } from "@/lib/supabase/server";

/**
 * Lineage domain/service (Story 5.3 / FR16) — READ-ONLY reads over the `workflow_lineage` closure
 * table (written by the Story 5.1 fork trigger). The closure collapses recursion into ONE indexed
 * flat query (no read-time recursion, AC3): a workflow's whole subtree is `where ancestor_id =
 * $root`; its ancestry is `where descendant_id = $node`. RLS on `workflow_lineage` gates each row
 * by DESCENDANT visibility (`status='published' OR author_id = auth.uid()`), so the tree is already
 * privacy-filtered — a stranger's private draft fork never appears, and even the root's owner only
 * sees published-or-their-own descendants (no privileged full-tree view). The raw `fork_count` can
 * therefore EXCEED the visible node count (it counts private forks too) — surface it honestly, never
 * "showing all N forks". Node payloads are batch-enriched via the proven Story 5.2 2-step `.in()`
 * pattern (NOT a self-referential nested embed, which errors at runtime). The client-safe types +
 * `buildLineageForest` + `layoutLineage` live in `@/lib/lineage` (this module is `server-only`).
 */

const LINEAGE_NODE_SELECT =
  "id, title, summary, status, fork_count, worked_score, tried_count, parent_id, author:profiles!workflows_author_id_fkey(handle, display_name, avatar_url)";

type LineageWorkflowRow = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  fork_count: number;
  worked_score: number;
  tried_count: number;
  parent_id: string | null;
  author: {
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

function toLineageNode(row: LineageWorkflowRow, depth: number): LineageNode {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    forkCount: row.fork_count,
    workedScore: row.worked_score,
    triedCount: row.tried_count,
    depth,
    parentId: row.parent_id,
    author: row.author,
  };
}

/**
 * Enrich `(workflow_id, depth)` closure rows into LineageNodes via ONE batch `.in()` query (the
 * Story 5.2 2-step pattern). The workflows RLS bounds the batch to published-or-mine rows; a row
 * that doesn't resolve is dropped (graceful — the same `?? null`-style miss handling 5.2 uses).
 * Preserves the input order (depth-asc for the subtree, depth-desc for ancestry).
 */
async function enrichLineageRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: { id: string; depth: number }[],
): Promise<LineageNode[]> {
  const ids = [...new Set(rows.map((r) => r.id))];
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("workflows")
    .select(LINEAGE_NODE_SELECT)
    .in("id", ids);
  const byId = new Map<string, LineageWorkflowRow>();
  for (const w of (data ?? []) as LineageWorkflowRow[]) byId.set(w.id, w);
  const nodes: LineageNode[] = [];
  for (const r of rows) {
    const w = byId.get(r.id);
    if (w) nodes.push(toLineageNode(w, r.depth));
  }
  return nodes;
}

/**
 * The visible descendants subtree of `rootId` (AC1/AC3) — the self-row (root, depth 0) plus every
 * transitive descendant the caller may see, depth-asc. ONE indexed flat query on
 * `workflow_lineage_ancestor_idx (ancestor_id, depth)`, no recursion. The depth filter (AC2) is
 * applied client-side on this (small, v1) result — true per-level lazy-load is deferred.
 */
export const getLineageTree = cache(
  async (rootId: string): Promise<LineageNode[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("workflow_lineage")
      .select("descendant_id, depth")
      .eq("ancestor_id", rootId)
      .order("depth", { ascending: true });
    const rows = (
      (data ?? []) as { descendant_id: string; depth: number }[]
    ).map((r) => ({ id: r.descendant_id, depth: r.depth }));
    return enrichLineageRows(supabase, rows);
  },
);

/**
 * The ancestry chain of `nodeId` for the breadcrumb (AC1) — origin root → … → here, root-first
 * (depth-desc; the self-row at depth 0 is the last/current crumb). ONE indexed flat query on
 * `workflow_lineage_descendant_idx (descendant_id)`. Direction discipline: ancestry filters
 * `descendant_id` (the subtree filters `ancestor_id`) — inverting returns forks instead of parents.
 */
export const getAncestry = cache(
  async (nodeId: string): Promise<LineageNode[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("workflow_lineage")
      .select("ancestor_id, depth")
      .eq("descendant_id", nodeId)
      .order("depth", { ascending: false });
    const rows = ((data ?? []) as { ancestor_id: string; depth: number }[]).map(
      (r) => ({ id: r.ancestor_id, depth: r.depth }),
    );
    return enrichLineageRows(supabase, rows);
  },
);
