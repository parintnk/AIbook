import "server-only";
import { cache } from "react";
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Workflows domain/service layer (DR-1) — the ONLY place workflow SQL lives.
 * Story 2.1 ships draft CRUD; nodes/edges/outputs/publish are Stories 2.2-2.5.
 * RLS enforces ownership (drafts are private to author_id); these functions
 * additionally scope every query to the caller + status='draft' so a caller can
 * only ever touch their own drafts.
 */

export type Workflow = Tables<"workflows">;
export type DraftListItem = Workflow & {
  profession: { slug: string; name: string } | null;
};

/** A published workflow for the public viewer (Story 3.1) — joins the author. */
export type PublishedWorkflow = Workflow & {
  profession: { slug: string; name: string } | null;
  author: {
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export type DraftInput = {
  title: string;
  summary: string | null;
  profession_id: string;
};

export type WorkflowResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "not_found"
        | "invalid_profession"
        | "db_error";
    };

/** A node that still lacks a sample output, blocking publish (FR10). */
export type PublishMissingNode = { id: string; idx: number };

/**
 * Publish carries a `missing` node list on the gate failure, which the generic
 * `WorkflowResult` can't. `not_found` covers both "not your draft" and "already
 * published" (the RPC's single 42501 path); `missing_outputs`/`no_nodes` are the
 * FR10/FR9 gate rejections.
 */
export type PublishResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "not_found"
        | "missing_outputs"
        | "no_nodes"
        | "db_error";
      missing?: PublishMissingNode[];
    };

const DRAFT_SELECT =
  "*, profession:professions!workflows_profession_id_fkey(slug, name)";

const PUBLISHED_SELECT =
  "*, profession:professions!workflows_profession_id_fkey(slug, name), author:profiles!workflows_author_id_fkey(handle, display_name, avatar_url)";

/** The caller's own draft workflows, newest-updated first. RLS scopes to author. */
export const listMyDrafts = cache(async (): Promise<DraftListItem[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("workflows")
    .select(DRAFT_SELECT)
    .eq("author_id", user.id)
    .eq("status", "draft")
    .order("updated_at", { ascending: false });
  return (data as DraftListItem[] | null) ?? [];
});

/** A single draft the caller owns, or null. RLS + the filters enforce ownership. */
export const getMyDraft = cache(
  async (id: string): Promise<DraftListItem | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("workflows")
      .select(DRAFT_SELECT)
      .eq("id", id)
      .eq("author_id", user.id)
      .eq("status", "draft")
      .maybeSingle();
    return (data as DraftListItem | null) ?? null;
  },
);

/**
 * A single PUBLISHED workflow for the public detail viewer (Story 3.1 / FR6).
 * NO auth guard — RLS (`status='published' OR author`) is the boundary, and a
 * signed-out visitor must be able to read it. A draft / nonexistent / other id
 * resolves to null (RLS hides it) → the route calls notFound().
 */
export const getPublishedWorkflow = cache(
  async (id: string): Promise<PublishedWorkflow | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("workflows")
      .select(PUBLISHED_SELECT)
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    return (data as PublishedWorkflow | null) ?? null;
  },
);

/** Create a draft owned by the caller (status defaults to 'draft'). */
export async function createDraft(input: DraftInput): Promise<WorkflowResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("workflows")
    .insert({
      author_id: user.id,
      profession_id: input.profession_id,
      title: input.title,
      summary: input.summary,
    })
    .select("id")
    .single();
  if (error) {
    // 23503 = foreign_key_violation (profession_id isn't a real profession).
    if (error.code === "23503")
      return { ok: false, error: "invalid_profession" };
    return { ok: false, error: "db_error" };
  }
  return { ok: true, id: data.id };
}

/** Update a draft the caller owns (title/summary/profession only — never status). */
export async function updateDraft(
  id: string,
  input: DraftInput,
): Promise<WorkflowResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const patch: TablesUpdate<"workflows"> = {
    title: input.title,
    summary: input.summary,
    profession_id: input.profession_id,
  };
  // `.select()` so a zero-row UPDATE (someone else's / nonexistent draft) is a
  // typed not_found, not a false success (the 1.4 updateProfile bug class).
  const { data, error } = await supabase
    .from("workflows")
    .update(patch)
    .eq("id", id)
    .eq("author_id", user.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23503")
      return { ok: false, error: "invalid_profession" };
    return { ok: false, error: "db_error" };
  }
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, id: data.id };
}

/**
 * Publish a draft (FR9/FR10 MOAT gate). Delegates to the `publish_workflow`
 * SECURITY DEFINER RPC — the ONLY path that may flip status→'published', since
 * the 2.1 column lock keeps status/published_at revoked from `authenticated` for
 * direct writes. The RPC re-asserts owner+draft itself and returns a jsonb
 * `{ ok, reason, missing }`; we map it to the typed PublishResult.
 */
export async function publishWorkflow(
  workflowId: string,
): Promise<PublishResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase.rpc("publish_workflow", {
    p_workflow_id: workflowId,
  });
  if (error) {
    // 42501 = the RPC's owner/draft re-assertion failed (not your draft, or
    // already published). Map to not_found, the codebase convention.
    if (error.code === "42501") return { ok: false, error: "not_found" };
    return { ok: false, error: "db_error" };
  }

  // The RPC always returns a non-null jsonb object; guard the null case anyway so a
  // malformed/empty response degrades to db_error instead of a TypeError.
  if (!data) return { ok: false, error: "db_error" };
  // The RPC is the sole producer of this shape; a cast (not a parse) matches the
  // 2.3 Args cast convention in workflow-nodes.ts.
  const result = data as {
    ok: boolean;
    reason: "no_nodes" | "missing_outputs" | null;
    missing: PublishMissingNode[];
  };
  if (result.ok) return { ok: true, id: workflowId };
  if (result.reason === "no_nodes") return { ok: false, error: "no_nodes" };
  if (result.reason === "missing_outputs")
    return { ok: false, error: "missing_outputs", missing: result.missing };
  return { ok: false, error: "db_error" };
}

/** Delete a draft the caller owns. Zero-row delete → not_found. */
export async function deleteDraft(id: string): Promise<WorkflowResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("workflows")
    .delete()
    .eq("id", id)
    .eq("author_id", user.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, id: data.id };
}
