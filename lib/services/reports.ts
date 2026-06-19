import "server-only";
import { cache } from "react";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";

/**
 * Reports domain/service layer (Story 4.3 / FR14) — the ONLY place reports SQL lives.
 * Any signed-in user can report a PUBLISHED workflow or a comment on one; the report lands in
 * `reports` (`status='open'`). A MODERATOR of the target's profession (the founder, mod of all,
 * in v1) reads + resolves the queue. Reporters CANNOT read the queue (RLS) → `createReport` is a
 * bare insert (no read-back). The target is polymorphic (`target_type` + `target_id`, no FK); a
 * before-insert trigger validates it (published-only) + denormalizes `profession_id`, and a
 * before-update trigger stamps `resolved_by`/`resolved_at`. Mirrors `comments.ts`.
 */

export type Report = Tables<"reports">;
export type ReportReason = Database["public"]["Enums"]["report_reason"];
export type ReportTargetType =
  Database["public"]["Enums"]["report_target_type"];

export type ReportReporter = {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** A report enriched for the moderator queue: reporter profile + the target's title/preview/profession. */
export type ReportView = Report & {
  reporter: ReportReporter | null;
  targetTitle: string | null;
  targetPreview: string | null;
  professionName: string | null;
};

export type CreateReportResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "already_reported"
        | "invalid_target"
        | "db_error";
    };

export type ModerationResult =
  | { ok: true }
  | { ok: false; error: "not_authenticated" | "not_found" | "db_error" };

export const REPORTS_PAGE_SIZE = 20;

const REPORTER_SELECT =
  "*, reporter:profiles!reports_reporter_id_fkey(handle, display_name, avatar_url)";

type ReportRow = Report & { reporter: ReportReporter | null };

/**
 * File a report on a published workflow / a comment on one. Bare insert (no `.select()`): the
 * reporter CANNOT read `reports` under RLS, so a read-back would look like a failure. `reporter_id`
 * defaults to auth.uid() (not grantable → no spoof); `profession_id` is set by the before-insert
 * trigger, which also rejects a non-published / nonexistent target (→ `invalid_target`). The
 * partial-unique blocks a duplicate OPEN report (→ `already_reported`).
 */
export async function createReport(
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason,
  detail?: string | null,
): Promise<CreateReportResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase.from("reports").insert({
    target_type: targetType,
    target_id: targetId,
    reason,
    detail: detail?.trim() || null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "already_reported" };
    if (error.code === "P0001") return { ok: false, error: "invalid_target" };
    return { ok: false, error: "db_error" };
  }
  return { ok: true };
}

/** Whether the caller moderates ANY profession (the founder mods all in v1). Gates the /admin/reports page. */
export async function isModeratorAnywhere(): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return false;
  const { count } = await supabase
    .from("profession_members")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("role", "moderator");
  return (count ?? 0) > 0;
}

/**
 * A page of OPEN reports for the moderator queue (RLS already scopes to the caller's moderated
 * professions). Each enriched with the reporter profile + the target's title/preview + profession.
 */
export const listOpenReports = cache(
  async (opts?: { limit?: number; offset?: number }): Promise<ReportView[]> => {
    const limit = opts?.limit ?? REPORTS_PAGE_SIZE;
    const offset = opts?.offset ?? 0;
    const supabase = await createClient();

    const { data } = await supabase
      .from("reports")
      .select(REPORTER_SELECT)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    const rows = (data ?? []) as ReportRow[];
    if (rows.length === 0) return [];

    // Resolve the polymorphic targets (RLS lets a moderator read the published target).
    const wfIds = rows
      .filter((r) => r.target_type === "workflow")
      .map((r) => r.target_id);
    const commentIds = rows
      .filter((r) => r.target_type === "comment")
      .map((r) => r.target_id);

    const wfMap = new Map<
      string,
      { title: string; professionName: string | null }
    >();
    if (wfIds.length > 0) {
      const { data: wfs } = await supabase
        .from("workflows")
        .select("id, title, profession:professions(name)")
        .in("id", wfIds);
      for (const w of (wfs ?? []) as Array<{
        id: string;
        title: string;
        profession: { name: string } | null;
      }>) {
        wfMap.set(w.id, {
          title: w.title,
          professionName: w.profession?.name ?? null,
        });
      }
    }

    const commentMap = new Map<
      string,
      { body: string; title: string | null; professionName: string | null }
    >();
    if (commentIds.length > 0) {
      const { data: cs } = await supabase
        .from("comments")
        .select(
          "id, body, workflow:workflows(title, profession:professions(name))",
        )
        .in("id", commentIds);
      for (const c of (cs ?? []) as Array<{
        id: string;
        body: string;
        workflow: { title: string; profession: { name: string } | null } | null;
      }>) {
        commentMap.set(c.id, {
          body: c.body,
          title: c.workflow?.title ?? null,
          professionName: c.workflow?.profession?.name ?? null,
        });
      }
    }

    return rows.map((r): ReportView => {
      if (r.target_type === "workflow") {
        const t = wfMap.get(r.target_id);
        return {
          ...r,
          targetTitle: t?.title ?? null,
          targetPreview: null,
          professionName: t?.professionName ?? null,
        };
      }
      const t = commentMap.get(r.target_id);
      return {
        ...r,
        targetTitle: t?.title ?? null,
        targetPreview: t ? t.body.slice(0, 280) : null,
        professionName: t?.professionName ?? null,
      };
    });
  },
);

/**
 * Mark a report resolved (moderator-only via RLS; the trigger stamps resolved_by/resolved_at).
 * Returns `not_found` when RLS denies (a non-moderator, or no such open report).
 */
export async function resolveReport(
  reportId: string,
  resolution?: string | null,
): Promise<ModerationResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("reports")
    .update({ status: "resolved", resolution: resolution?.trim() || null })
    .eq("id", reportId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Hide a reported comment (set `deleted_at` → the "[comment removed]" tombstone; moderator-only via
 * the `comments_update_moderator` policy + the `deleted_at` column-grant) AND resolve every open
 * report on it. Workflow takedown is not provisioned (no `deleted_at` on workflows) — deferred.
 */
export async function removeReportedComment(
  commentId: string,
  resolution?: string | null,
): Promise<ModerationResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: hidden, error: hideError } = await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .select("id")
    .maybeSingle();
  if (hideError) return { ok: false, error: "db_error" };
  if (!hidden) return { ok: false, error: "not_found" };

  const { error: resolveError } = await supabase
    .from("reports")
    .update({
      status: "resolved",
      resolution: resolution?.trim() || "Content removed",
    })
    .eq("target_type", "comment")
    .eq("target_id", commentId)
    .eq("status", "open");
  if (resolveError) return { ok: false, error: "db_error" };
  return { ok: true };
}
