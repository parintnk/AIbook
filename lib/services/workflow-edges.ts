import "server-only";
import { cache } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { ownsDraft } from "./workflow-nodes";

/**
 * Workflow-edges domain/service layer (DR-1, Story 2.3) — the ONLY place edge SQL
 * lives. An edge is a directed connection source→target between two nodes of the
 * SAME workflow (supports branching). Edges have no author_id; ownership is derived
 * from the parent workflow, so RLS gates reads (published-or-author) and writes
 * (author of the parent draft). Edges are immutable (create/delete only).
 * Defense-in-depth atop RLS: createEdge confirms the caller owns the *draft* AND
 * that both endpoints belong to that workflow (the FK only checks the nodes exist,
 * not their parent — this is the sole cross-workflow guard); deleteEdge uses
 * `.select().maybeSingle()` so an RLS-filtered row surfaces as a typed not_found.
 */

export type WorkflowEdge = Tables<"workflow_edges">;

export type EdgeResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "not_found"
        | "invalid_nodes"
        | "self_edge"
        | "duplicate"
        | "db_error";
    };

/** The edges of a workflow, oldest first. RLS scopes visibility to the caller. */
export const listEdges = cache(
  async (workflowId: string): Promise<WorkflowEdge[]> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("workflow_edges")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("created_at", { ascending: true });
    return (data as WorkflowEdge[] | null) ?? [];
  },
);

/** Connect two nodes of a draft the caller owns (directed source→target). */
export async function createEdge(
  workflowId: string,
  sourceNodeId: string,
  targetNodeId: string,
): Promise<EdgeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };
  if (sourceNodeId === targetNodeId) return { ok: false, error: "self_edge" };

  // Defense-in-depth: only the owner of the *draft* may wire it.
  if (!(await ownsDraft(supabase, user.id, workflowId)))
    return { ok: false, error: "not_found" };

  // BOTH endpoints must belong to THIS workflow. The FK only verifies the nodes
  // exist, not their parent — so without this an owner could wire to a node id
  // from a published-but-not-owned workflow. This is the only cross-workflow guard.
  const { data: nodes } = await supabase
    .from("workflow_nodes")
    .select("id")
    .eq("workflow_id", workflowId)
    .in("id", [sourceNodeId, targetNodeId]);
  if (!nodes || nodes.length !== 2)
    return { ok: false, error: "invalid_nodes" };

  const { data, error } = await supabase
    .from("workflow_edges")
    .insert({
      workflow_id: workflowId,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "duplicate" }; // unique
    if (error.code === "23503") return { ok: false, error: "invalid_nodes" }; // FK
    if (error.code === "23514") return { ok: false, error: "self_edge" }; // check
    return { ok: false, error: "db_error" };
  }
  return { ok: true, id: data.id };
}

/** Delete an edge. RLS enforces parent-draft ownership; zero rows → not_found. */
export async function deleteEdge(edgeId: string): Promise<EdgeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("workflow_edges")
    .delete()
    .eq("id", edgeId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, id: data.id };
}
