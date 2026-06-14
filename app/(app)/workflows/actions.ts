"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createEdge, deleteEdge } from "@/lib/services/workflow-edges";
import {
  createNode,
  deleteNode,
  type NodeInput,
  reorderNodes,
  updateNode,
  updateNodePositions,
} from "@/lib/services/workflow-nodes";
import {
  createDraft,
  deleteDraft,
  updateDraft,
} from "@/lib/services/workflows";
import {
  edgeEndpointsSchema,
  nodeIdsSchema,
  nodePositionsSchema,
  type WorkflowFormState,
  type WorkflowNodeValues,
  workflowDraftSchema,
  workflowNodeSchema,
} from "@/lib/validation/workflow";

function message(
  error:
    | "not_authenticated"
    | "not_found"
    | "invalid_profession"
    | "invalid_workflow"
    | "invalid_nodes"
    | "self_edge"
    | "duplicate"
    | "db_error",
): string {
  if (error === "not_authenticated") return "You must be signed in.";
  if (error === "invalid_profession")
    return "That profession is no longer available — pick another.";
  if (error === "invalid_workflow") return "That draft no longer exists.";
  if (error === "not_found") return "That draft no longer exists.";
  if (error === "invalid_nodes") return "Those steps can't be connected.";
  if (error === "self_edge") return "A step can't connect to itself.";
  if (error === "duplicate") return "Those steps are already connected.";
  return "Something went wrong. Please try again.";
}

/** Trim-to-null the optional node fields (the schema already trimmed each value). */
function toNodeInput(v: WorkflowNodeValues): NodeInput {
  return {
    step_title: v.step_title || null,
    tool_name: v.tool_name,
    tool_version: v.tool_version || null,
    prompt: v.prompt,
    purpose: v.purpose,
    est_time: v.est_time || null,
    est_cost: v.est_cost || null,
    notes: v.notes || null,
    note_lang: v.note_lang || null,
    tool_url: v.tool_url || null,
  };
}

export async function createDraftAction(
  values: unknown,
): Promise<WorkflowFormState> {
  const parsed = workflowDraftSchema.safeParse(values);
  if (!parsed.success) return { error: "Please fix the highlighted fields." };
  const v = parsed.data;

  const result = await createDraft({
    title: v.title,
    summary: v.summary.trim() || null,
    profession_id: v.profession_id,
  });
  if (!result.ok) return { error: message(result.error) };

  revalidatePath("/workflows");
  redirect("/workflows");
}

export async function updateDraftAction(
  id: string,
  values: unknown,
): Promise<WorkflowFormState> {
  const parsed = workflowDraftSchema.safeParse(values);
  if (!parsed.success) return { error: "Please fix the highlighted fields." };
  const v = parsed.data;

  const result = await updateDraft(id, {
    title: v.title,
    summary: v.summary.trim() || null,
    profession_id: v.profession_id,
  });
  if (!result.ok) return { error: message(result.error) };

  revalidatePath("/workflows");
  revalidatePath(`/workflows/${id}/edit`);
  redirect("/workflows");
}

export async function deleteDraftAction(
  id: string,
): Promise<WorkflowFormState> {
  const result = await deleteDraft(id);
  if (!result.ok) return { error: message(result.error) };
  revalidatePath("/workflows");
  return { success: true };
}

// ── Recipe-card nodes (Story 2.2) ───────────────────────────────────────────
// These never redirect — node editing happens inline on the draft edit page, so
// they revalidate that page and return state for the in-place form.

export async function createNodeAction(
  workflowId: string,
  values: unknown,
): Promise<WorkflowFormState> {
  const parsed = workflowNodeSchema.safeParse(values);
  if (!parsed.success) return { error: "Please fix the highlighted fields." };

  const result = await createNode(workflowId, toNodeInput(parsed.data));
  if (!result.ok) return { error: message(result.error) };

  revalidatePath(`/workflows/${workflowId}/edit`);
  // Return the new id so the canvas can chain/splice the node (Story 2.3).
  return { success: true, nodeId: result.id };
}

export async function updateNodeAction(
  workflowId: string,
  nodeId: string,
  values: unknown,
): Promise<WorkflowFormState> {
  const parsed = workflowNodeSchema.safeParse(values);
  if (!parsed.success) return { error: "Please fix the highlighted fields." };

  const result = await updateNode(nodeId, toNodeInput(parsed.data));
  if (!result.ok) return { error: message(result.error) };

  revalidatePath(`/workflows/${workflowId}/edit`);
  return { success: true };
}

export async function deleteNodeAction(
  workflowId: string,
  nodeId: string,
): Promise<WorkflowFormState> {
  const result = await deleteNode(nodeId);
  if (!result.ok) return { error: message(result.error) };

  revalidatePath(`/workflows/${workflowId}/edit`);
  return { success: true };
}

// ── React Flow graph (Story 2.3) ────────────────────────────────────────────
// Edges + node positions + reorder. Edge/reorder mutations revalidate the edit
// page so the linear step-list (RSC) re-renders; position autosave deliberately
// does NOT (the canvas owns positions mid-edit; the step-list ignores them).

export async function createEdgeAction(
  workflowId: string,
  source: string,
  target: string,
): Promise<WorkflowFormState> {
  const parsed = edgeEndpointsSchema.safeParse({ source, target });
  if (!parsed.success) return { error: "Invalid connection." };

  const result = await createEdge(
    workflowId,
    parsed.data.source,
    parsed.data.target,
  );
  if (!result.ok) return { error: message(result.error) };

  revalidatePath(`/workflows/${workflowId}/edit`);
  return { success: true };
}

export async function deleteEdgeAction(
  workflowId: string,
  edgeId: string,
): Promise<WorkflowFormState> {
  const result = await deleteEdge(edgeId);
  if (!result.ok) return { error: message(result.error) };

  revalidatePath(`/workflows/${workflowId}/edit`);
  return { success: true };
}

export async function updateNodePositionsAction(
  workflowId: string,
  positions: unknown,
): Promise<WorkflowFormState> {
  const parsed = nodePositionsSchema.safeParse(positions);
  if (!parsed.success) return { error: "Invalid positions." };

  const result = await updateNodePositions(workflowId, parsed.data);
  if (!result.ok) return { error: message(result.error) };
  // No revalidatePath — positions are reflected client-side; the step-list
  // ignores pos_x/pos_y, so a drag must never disturb the RSC list.
  return { success: true };
}

export async function reorderNodesAction(
  workflowId: string,
  nodeIds: unknown,
): Promise<WorkflowFormState> {
  const parsed = nodeIdsSchema.safeParse(nodeIds);
  if (!parsed.success) return { error: "Invalid order." };

  const result = await reorderNodes(workflowId, parsed.data);
  if (!result.ok) return { error: message(result.error) };

  revalidatePath(`/workflows/${workflowId}/edit`);
  return { success: true };
}
