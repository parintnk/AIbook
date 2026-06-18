"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DoctorActionState } from "@/lib/ai";
import { reviewWorkflow } from "@/lib/services/ai/doctor";
import { checkAndConsumeQuota } from "@/lib/services/ai/rate-limit";
import { generateSkeleton } from "@/lib/services/ai/skeleton";
import {
  type CommentPage,
  type CommentSort,
  listCommentPage,
  type PostCommentResult,
  postComment,
  type ToggleLikeResult,
  toggleCommentLike,
} from "@/lib/services/comments";
import {
  deleteNodeOutput,
  deriveThumbPath,
  getNodeOutput,
  listOutputViewsForWorkflow,
  upsertTextOutput,
} from "@/lib/services/node-outputs";
import {
  castOutcomeVote,
  type OutcomeVerdict,
} from "@/lib/services/outcome-votes";
import { createReport } from "@/lib/services/reports";
import { createSupabaseStorage } from "@/lib/services/storage/supabase-storage";
import { createEdge, deleteEdge } from "@/lib/services/workflow-edges";
import {
  createNode,
  deleteNode,
  listDraftNodes,
  type NodeInput,
  reorderNodes,
  updateNode,
  updateNodePositions,
} from "@/lib/services/workflow-nodes";
import {
  createDraft,
  deleteDraft,
  forkWorkflow,
  getMyDraft,
  publishWorkflow,
  updateDraft,
} from "@/lib/services/workflows";
import { createClient } from "@/lib/supabase/server";
import { textOutputSchema } from "@/lib/validation/output";
import { reportSchema } from "@/lib/validation/report";
import {
  edgeEndpointsSchema,
  nodeIdsSchema,
  nodePositionsSchema,
  type SkeletonActionState,
  skeletonIntakeSchema,
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
    | "invalid_output"
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
  if (error === "invalid_output") return "That output couldn't be saved.";
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
    tags: v.tags,
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
    tags: v.tags,
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

// ── Publish gate (Story 2.5, FR9/FR10 MOAT) ─────────────────────────────────
// The draft → published transition. On success it redirects to /workflows (the
// published workflow leaves the drafts list; Epic 3's public viewer doesn't
// exist yet). The gate rejections (no_nodes/missing_outputs) carry bespoke copy
// — kept OUT of message() — and missing_outputs returns the node ids so a stale
// client can re-paint amber.

export async function publishWorkflowAction(
  workflowId: string,
): Promise<WorkflowFormState> {
  const result = await publishWorkflow(workflowId);
  if (result.ok) {
    revalidatePath("/workflows");
    revalidatePath(`/workflows/${workflowId}/edit`);
    redirect("/workflows");
  }
  if (result.error === "no_nodes")
    return { error: "Add at least one step before publishing." };
  if (result.error === "missing_outputs")
    return {
      error: "Every step needs a sample output before you can publish.",
      missingNodeIds: (result.missing ?? []).map((m) => m.id),
    };
  return { error: message(result.error) };
}

/**
 * Fork a published workflow into the caller's new editable draft (Story 5.1 / FR15). Returns the
 * new draft's id so the client toasts "Forked. Editing your copy." THEN navigates into the editor
 * (a server redirect would skip the toast). revalidate the source so its fork_count is fresh if
 * the user returns. Fork is NOT optimistic (the button waits for this result — UX-DR7).
 */
export async function forkWorkflowAction(
  sourceId: string,
): Promise<{ ok: true; forkId: string } | { ok: false; error: string }> {
  const result = await forkWorkflow(sourceId);
  if (result.ok) {
    revalidatePath(`/workflows/${sourceId}`);
    return { ok: true, forkId: result.forkId };
  }
  if (result.error === "not_authenticated")
    return { ok: false, error: "Sign in to fork." };
  if (result.error === "invalid_source")
    return { ok: false, error: "That workflow can't be forked." };
  return { ok: false, error: "Couldn't fork this workflow. Please try again." };
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

// ── AI Skeleton (Story 11.2 / FR8) ──────────────────────────────────────────
// Profession (from the draft) + a one-sentence goal → Gemini generateObject (rate-limited via the
// 11.1 quota) → the atomic append_skeleton RPC drops the 3–5 node chain onto the draft. The canvas
// re-seeds on the client's router.refresh(). No new route — the intake lives in the edit page.
export async function generateSkeletonAction(
  workflowId: string,
  values: unknown,
): Promise<SkeletonActionState> {
  const parsed = skeletonIntakeSchema.safeParse(values);
  if (!parsed.success) return { error: "Add a one-sentence goal." };

  // Owner + draft gate FIRST (so a non-owner never burns quota); also yields the profession.
  const draft = await getMyDraft(workflowId);
  if (!draft) return { error: message("not_found") };

  // Rate limit (consume-on-attempt) — the Story 11.1 primitive.
  const quota = await checkAndConsumeQuota({ feature: "skeleton" });
  if (quota.error === "not_authenticated")
    return { error: message("not_authenticated") };
  if (!quota.allowed)
    return { rateLimited: true, used: quota.used, limit: quota.limit };

  let nodes: Awaited<ReturnType<typeof generateSkeleton>>;
  try {
    nodes = await generateSkeleton({
      profession: draft.profession?.name ?? "creator",
      goal: parsed.data.goal,
    });
  } catch {
    return { error: "Couldn't draft a skeleton. Please try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("append_skeleton", {
    p_workflow_id: workflowId,
    p_nodes: nodes,
  });
  if (error) {
    if (error.code === "42501") return { error: message("not_found") };
    return { error: message("db_error") };
  }

  revalidatePath(`/workflows/${workflowId}/edit`);
  return { success: true, nodeIds: (data ?? []).map((r) => r.node_id) };
}

// ── AI Workflow Doctor (Story 11.3 / FR12) ──────────────────────────────────
// An advisory per-node pre-publish review (4 checks) via Gemini, rate-limited by the 11.1 quota
// (cap 10). READ-ONLY + transient: it reads the draft (nodes + outputs via the RLS client — the owner
// reads their own draft, no RPC/admin) and returns the verdict to the client. No DB write, no
// revalidatePath (the panel owns the result client-side). Advisory ONLY — it never gates publish
// (only FR10 / publishWorkflow does); the deterministic missing_output flag is merged for fidelity.
export async function reviewWorkflowAction(
  workflowId: string,
): Promise<DoctorActionState> {
  // Owner + draft gate FIRST (so a non-owner never burns quota).
  const draft = await getMyDraft(workflowId);
  if (!draft) return { ok: false, error: message("not_found") };

  // Read the draft nodes BEFORE consuming quota so an empty draft never burns a run (the owner gate
  // above already blocks non-owners). A real review attempt is still consume-on-attempt (Story 11.1).
  const nodes = await listDraftNodes(workflowId);
  if (nodes.length === 0)
    return { ok: false, error: "Add a step before reviewing." };

  // Rate limit (consume-on-attempt) — the Story 11.1 primitive.
  const quota = await checkAndConsumeQuota({ feature: "doctor" });
  if (quota.error === "not_authenticated")
    return { ok: false, error: message("not_authenticated") };
  if (!quota.allowed)
    return {
      ok: false,
      rateLimited: true,
      used: quota.used,
      limit: quota.limit,
    };

  // Outputs (signed URLs) only after passing quota. The FR10 real-output rule, computed
  // deterministically from the SAME publish-gate data.
  const outputs = await listOutputViewsForWorkflow(workflowId);
  const missingOutputNodeIds = nodes
    .filter((n) => !outputs[n.id])
    .map((n) => n.id);

  try {
    const review = await reviewWorkflow({ nodes, missingOutputNodeIds });
    return { ok: true, review };
  } catch {
    return { ok: false, error: "Couldn't run the review. Please try again." };
  }
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

// ── Sample outputs (Story 2.4) ──────────────────────────────────────────────
// Binary uploads go through the Route Handler (1MB Server Action body limit). Text
// + delete are small → they stay Server Actions. Both revalidate the edit page so
// the RSC surface re-renders the node's output slot.

export async function setTextOutputAction(
  workflowId: string,
  nodeId: string,
  text: unknown,
): Promise<WorkflowFormState> {
  const parsed = textOutputSchema.safeParse({ text });
  if (!parsed.success) return { error: "Please add some text." };

  // Capture any prior binary object BEFORE the row flips to text (storage_path → null)
  // so replacing an image/video/file with text doesn't orphan the stored object(s).
  const prior = await getNodeOutput(nodeId);

  const result = await upsertTextOutput({ nodeId, text: parsed.data.text });
  if (!result.ok) return { error: message(result.error) };

  if (prior?.storage_path) {
    const supabase = await createClient();
    const storage = createSupabaseStorage(supabase);
    await storage
      .remove([prior.storage_path, deriveThumbPath(prior.storage_path)])
      .catch(() => {});
  }

  revalidatePath(`/workflows/${workflowId}/edit`);
  return { success: true };
}

export async function deleteOutputAction(
  workflowId: string,
  nodeId: string,
): Promise<WorkflowFormState> {
  const result = await deleteNodeOutput(nodeId);
  if (!result.ok) return { error: message(result.error) };

  // Best-effort removal of the freed storage object(s) (none for a text output).
  if (result.freedPaths.length) {
    const supabase = await createClient();
    const storage = createSupabaseStorage(supabase);
    await storage.remove(result.freedPaths).catch(() => {});
  }

  revalidatePath(`/workflows/${workflowId}/edit`);
  return { success: true };
}

/**
 * Cast / change the caller's outcome vote (Story 4.1 / FR11). The recompute trigger
 * updates the workflow's denormalized tallies; revalidate the detail path so the
 * trust row + segment counts re-read the recomputed truth (the client also
 * optimistically updates + `router.refresh()`es).
 */
export async function castOutcomeVoteAction(
  workflowId: string,
  verdict: OutcomeVerdict,
  note?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await castOutcomeVote(workflowId, verdict, note);
  if (result.ok) {
    revalidatePath(`/workflows/${workflowId}`);
    return { ok: true };
  }
  return { ok: false, error: result.error };
}

/**
 * Post a comment / 1-level reply (Story 4.2 / FR19). Returns the new enriched comment so
 * the client reconciles its optimistic insert. No `revalidatePath`: the thread owns its
 * loaded-page state client-side (a refresh would reset Load-more + scroll, and re-run the
 * whole detail RSC). The route is dynamic, so a cold reload / back-nav re-fetches fresh.
 */
export async function postCommentAction(
  workflowId: string,
  body: string,
  parentCommentId?: string | null,
): Promise<PostCommentResult> {
  return postComment(workflowId, body, parentCommentId);
}

/** Toggle the caller's like on a comment; the ±1 trigger maintains like_count. */
export async function toggleCommentLikeAction(
  commentId: string,
): Promise<ToggleLikeResult> {
  return toggleCommentLike(commentId);
}

/** Fetch the next page of top-level comments — the "Load more" affordance (read-only). */
export async function loadMoreCommentsAction(
  workflowId: string,
  sort: CommentSort,
  offset: number,
): Promise<CommentPage> {
  return listCommentPage(workflowId, { sort, offset });
}

/**
 * File a report on a workflow / comment (Story 4.3 / FR14). The action is the trust boundary
 * (Zod-validates reason + detail). `already_reported` is a soft-success (the user already filed an
 * open report — a friendly toast, not an error). No `revalidatePath`: nothing on the page changes.
 */
export async function submitReportAction(
  input: unknown,
): Promise<{ ok: true; duplicate?: boolean } | { ok: false; error: string }> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Couldn't submit your report. Please try again.",
    };
  const { targetType, targetId, reason, detail } = parsed.data;

  const result = await createReport(targetType, targetId, reason, detail);
  if (result.ok) return { ok: true };
  if (result.error === "already_reported") return { ok: true, duplicate: true };
  if (result.error === "not_authenticated")
    return { ok: false, error: "You must be signed in to report." };
  if (result.error === "invalid_target")
    return { ok: false, error: "That content can't be reported." };
  return { ok: false, error: "Couldn't submit your report. Please try again." };
}
