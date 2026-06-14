"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createNode,
  deleteNode,
  type NodeInput,
  updateNode,
} from "@/lib/services/workflow-nodes";
import {
  createDraft,
  deleteDraft,
  updateDraft,
} from "@/lib/services/workflows";
import {
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
    | "db_error",
): string {
  if (error === "not_authenticated") return "You must be signed in.";
  if (error === "invalid_profession")
    return "That profession is no longer available — pick another.";
  if (error === "invalid_workflow") return "That draft no longer exists.";
  if (error === "not_found") return "That draft no longer exists.";
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
  return { success: true };
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
