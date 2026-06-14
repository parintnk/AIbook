"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createDraft,
  deleteDraft,
  updateDraft,
} from "@/lib/services/workflows";
import {
  type WorkflowFormState,
  workflowDraftSchema,
} from "@/lib/validation/workflow";

function message(
  error: "not_authenticated" | "not_found" | "invalid_profession" | "db_error",
): string {
  if (error === "not_authenticated") return "You must be signed in.";
  if (error === "invalid_profession")
    return "That profession is no longer available — pick another.";
  if (error === "not_found") return "That draft no longer exists.";
  return "Something went wrong. Please try again.";
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
