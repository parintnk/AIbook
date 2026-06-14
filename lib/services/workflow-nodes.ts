import "server-only";
import { cache } from "react";
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Workflow-nodes domain/service layer (DR-1) — the ONLY place node SQL lives.
 * A node is one recipe-card step (tool + prompt + metadata, FR6). Nodes have no
 * author_id; ownership is derived from the parent workflow, so RLS gates reads
 * (published-or-author) and writes (author of the parent draft). These functions
 * add defense-in-depth atop RLS: createNode confirms the caller owns the *draft*
 * before inserting (the RLS insert `with check` is the only guard there), and
 * update/deleteNode use `.select().maybeSingle()` so an RLS-filtered row surfaces
 * as a typed not_found rather than a false success. The service never writes
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

/** True if `workflowId` is a draft owned by `userId` (the 2.2 edit-drafts rule). */
async function ownsDraft(
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

/** Append a node to a draft the caller owns (idx = max+1; pos defaults to 0). */
export async function createNode(
  workflowId: string,
  input: NodeInput,
): Promise<WorkflowNodeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  // Defense-in-depth: only the owner of the *draft* may add nodes to it.
  if (!(await ownsDraft(supabase, user.id, workflowId)))
    return { ok: false, error: "not_found" };

  // Next step index = current max + 1 (0 for the first node). The 2.3 canvas owns
  // reordering; 2.2 only appends.
  const { data: rows } = await supabase
    .from("workflow_nodes")
    .select("idx")
    .eq("workflow_id", workflowId)
    .order("idx", { ascending: false });
  const nextIdx = ((rows?.[0]?.idx as number | undefined) ?? -1) + 1;

  const { data, error } = await supabase
    .from("workflow_nodes")
    .insert({
      workflow_id: workflowId,
      idx: nextIdx,
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
    })
    .select("id")
    .single();
  if (error) {
    // 23503 = foreign_key_violation (workflow_id vanished in a race).
    if (error.code === "23503") return { ok: false, error: "invalid_workflow" };
    return { ok: false, error: "db_error" };
  }
  return { ok: true, id: data.id };
}

/** Update a node's fields. RLS enforces parent-draft ownership; zero rows → not_found. */
export async function updateNode(
  nodeId: string,
  input: NodeInput,
): Promise<WorkflowNodeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
