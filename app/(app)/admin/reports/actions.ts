"use server";

import { revalidatePath } from "next/cache";
import { removeReportedComment, resolveReport } from "@/lib/services/reports";

/**
 * Admin/moderator actions for the reports queue (Story 4.3 / FR14). RLS is the real gate
 * (`is_profession_moderator` on the report's profession) — a non-moderator's update affects 0 rows
 * → `not_found`. Both revalidate the queue so the list reflects the resolution.
 */

function modMessage(
  error: "not_authenticated" | "not_found" | "db_error",
): string {
  if (error === "not_authenticated") return "You must be signed in.";
  if (error === "not_found")
    return "You can't moderate that, or it's already handled.";
  return "Something went wrong. Please try again.";
}

export async function resolveReportAction(
  reportId: string,
  resolution?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await resolveReport(reportId, resolution);
  if (result.ok) {
    revalidatePath("/admin/reports");
    return { ok: true };
  }
  return { ok: false, error: modMessage(result.error) };
}

export async function removeCommentAction(
  commentId: string,
  resolution?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await removeReportedComment(commentId, resolution);
  if (result.ok) {
    revalidatePath("/admin/reports");
    return { ok: true };
  }
  return { ok: false, error: modMessage(result.error) };
}
