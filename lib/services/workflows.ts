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

const DRAFT_SELECT =
  "*, profession:professions!workflows_profession_id_fkey(slug, name)";

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
