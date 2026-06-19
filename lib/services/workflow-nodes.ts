import "server-only";
import { cache } from "react";
import type {
  Database,
  Tables,
  TablesUpdate,
} from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";

/**
 * Workflow-nodes domain/service layer (DR-1) — the ONLY place node SQL lives.
 * A node is one recipe-card step (tool + prompt + metadata, FR6). Nodes have no
 * author_id; ownership is derived from the parent workflow, so RLS gates reads
 * (published-or-author) and writes (author of the parent draft). These functions
 * add defense-in-depth atop RLS: createNode delegates to the atomic
 * `append_workflow_node` RPC (Story 2.3 — resolves the 2.2 read-then-write idx
 * race; the RPC re-asserts owner+draft and 42501→not_found), reorder/positions go
 * through their own atomic RPCs, and update/deleteNode use `.select().maybeSingle()`
 * so an RLS-filtered row surfaces as a typed not_found rather than a false success.
 * The service never writes
 * pos_x/pos_y (the 2.3 canvas owns positions) — but that is a service convention,
 * NOT a DB lock: the harden grants deliberately make pos_x/pos_y writable so 2.3
 * can use them. The columns the grants actually lock are id/created_at/updated_at
 * (always) and workflow_id (on update — no reparenting); status/published_at are
 * not columns on this table (those live on `workflows`, gated there in 2.5).
 */

export type WorkflowNode = Tables<"workflow_nodes">;

/** The editable field set (FR6). Optionals arrive as null (the action trims ""). */
export type NodeInput = {
  step_title: string | null;
  tool_name: string;
  tool_version: string | null;
  prompt: string;
  purpose: string;
  est_time: string | null;
  est_cost: string | null;
  notes: string | null;
  note_lang: string | null;
  tool_url: string | null;
};

export type WorkflowNodeResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "not_found"
        | "invalid_workflow"
        | "db_error";
    };

/**
 * True if `workflowId` is a draft owned by `userId` (the 2.2 edit-drafts rule).
 * Exported so the sibling workflow-edges service reuses the same ownership gate.
 */
export async function ownsDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  workflowId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("workflows")
    .select("id")
    .eq("id", workflowId)
    .eq("author_id", userId)
    .eq("status", "draft")
    .maybeSingle();
  return Boolean(data);
}

/** The nodes of a workflow, in step order. RLS scopes visibility to the caller. */
export const listDraftNodes = cache(
  async (workflowId: string): Promise<WorkflowNode[]> => {
    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) return [];
    const { data } = await supabase
      .from("workflow_nodes")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("idx", { ascending: true })
      // created_at tiebreak keeps ordering deterministic if two nodes ever share
      // an idx (no unique constraint — concurrent-add race, deferred to 2.3).
      .order("created_at", { ascending: true });
    return (data as WorkflowNode[] | null) ?? [];
  },
);

/**
 * Nodes of a workflow for the PUBLIC viewer (Story 3.1). NO auth guard — unlike
 * listDraftNodes, an anon visitor must see a published workflow's nodes; RLS
 * (`status='published' OR author`) is the boundary. Ordered by idx (step order).
 */
export const listPublishedNodes = cache(
  async (workflowId: string): Promise<WorkflowNode[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("workflow_nodes")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("idx", { ascending: true })
      .order("created_at", { ascending: true });
    return (data as WorkflowNode[] | null) ?? [];
  },
);

/**
 * Append a node to a draft the caller owns. Delegates to the atomic
 * `append_workflow_node` RPC (idx = max+1 under a row-lock — no read-then-write
 * race; pos defaults to 0). The RPC re-asserts owner+draft and raises 42501 →
 * not_found. Returns the new node id.
 */
export async function createNode(
  workflowId: string,
  input: NodeInput,
): Promise<WorkflowNodeResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase.rpc("append_workflow_node", {
    p_workflow_id: workflowId,
    p_step_title: input.step_title,
    p_tool_name: input.tool_name,
    p_tool_version: input.tool_version,
    p_prompt: input.prompt,
    p_purpose: input.purpose,
    p_est_time: input.est_time,
    p_est_cost: input.est_cost,
    p_notes: input.notes,
    p_note_lang: input.note_lang,
    p_tool_url: input.tool_url,
    // Supabase's type generator types these nullable text RPC args as non-null
    // `string`; the SQL params accept null, so pass our null optionals through.
  } as Database["public"]["Functions"]["append_workflow_node"]["Args"]);
  if (error) {
    if (error.code === "42501") return { ok: false, error: "not_found" };
    return { ok: false, error: "db_error" };
  }
  return { ok: true, id: data as string };
}

/** Update a node's fields. RLS enforces parent-draft ownership; zero rows → not_found. */
export async function updateNode(
  nodeId: string,
  input: NodeInput,
): Promise<WorkflowNodeResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  // Only the editable field columns. We deliberately omit idx/pos_x/pos_y (the
  // 2.3 canvas owns ordering + positions) and workflow_id. Of those, only
  // workflow_id is DB-enforced (not update-grantable → no reparenting); omitting
  // idx/pos is a service convention (they ARE update-grantable, for 2.3).
  const patch: TablesUpdate<"workflow_nodes"> = {
    step_title: input.step_title,
    tool_name: input.tool_name,
    tool_version: input.tool_version,
    prompt: input.prompt,
    purpose: input.purpose,
    est_time: input.est_time,
    est_cost: input.est_cost,
    notes: input.notes,
    note_lang: input.note_lang,
    tool_url: input.tool_url,
  };
  // `.select()` so a zero-row UPDATE (someone else's / nonexistent node, filtered
  // by RLS) is a typed not_found, not a false success.
  const { data, error } = await supabase
    .from("workflow_nodes")
    .update(patch)
    .eq("id", nodeId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, id: data.id };
}

/** Delete a node. RLS enforces parent-draft ownership; zero rows → not_found. */
export async function deleteNode(nodeId: string): Promise<WorkflowNodeResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("workflow_nodes")
    .delete()
    .eq("id", nodeId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, id: data.id };
}

/** A node's canvas position (Story 2.3). */
export type NodePosition = { id: string; pos_x: number; pos_y: number };

/**
 * Persist canvas drag for many nodes in one atomic RPC (Story 2.3). The 2.3
 * canvas owns pos_x/pos_y; this batches them so a drag flush is one round-trip
 * + one ownership check. RPC re-asserts owner+draft → 42501→not_found.
 */
export async function updateNodePositions(
  workflowId: string,
  positions: NodePosition[],
): Promise<WorkflowNodeResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase.rpc("update_node_positions", {
    p_workflow_id: workflowId,
    p_positions: positions,
  });
  if (error)
    return {
      ok: false,
      error: error.code === "42501" ? "not_found" : "db_error",
    };
  return { ok: true, id: workflowId };
}

/**
 * Set the full step order (`idx`) for a workflow in one atomic RPC (Story 2.3).
 * `nodeIds` must be exactly the workflow's node set, in the new order; the RPC
 * raises 22023 (node_set_mismatch → db_error) otherwise, and 42501 (not_owner →
 * not_found). Resolves the 2.2 deferred concurrent-ordering race.
 */
export async function reorderNodes(
  workflowId: string,
  nodeIds: string[],
): Promise<WorkflowNodeResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase.rpc("reorder_workflow_nodes", {
    p_workflow_id: workflowId,
    p_node_ids: nodeIds,
  });
  if (error)
    return {
      ok: false,
      error: error.code === "42501" ? "not_found" : "db_error",
    };
  return { ok: true, id: workflowId };
}
