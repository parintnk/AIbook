import "server-only";
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Profiles domain/service layer (architecture DR-1 — extract-later guardrail).
 * This is the ONLY place profile/ai_stack SQL lives; routes, pages, and server
 * actions call these functions instead of querying Supabase directly.
 */

export type Profile = Tables<"profiles">;
export type AiStackItem = Tables<"ai_stack_items">;
export type ProfileWithStack = Profile & { ai_stack_items: AiStackItem[] };

export type UpdateProfileInput = {
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  hire_me_url: string | null;
  hire_me_visible: boolean;
};

export type AiStackInput = {
  tool_name: string;
  skill_level: number;
  sort_order: number;
};

export type ServiceResult =
  | { ok: true }
  | { ok: false; error: "handle_taken" | "not_authenticated" | "db_error" };

/** Public read: a profile by handle, with its AI Stack ordered. Null if absent. */
export async function getProfileByHandle(
  handle: string,
): Promise<ProfileWithStack | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*, ai_stack_items(*)")
    .eq("handle", handle.toLowerCase())
    .order("sort_order", { referencedTable: "ai_stack_items", ascending: true })
    .maybeSingle();
  return (data as ProfileWithStack | null) ?? null;
}

/** The signed-in user's own profile (+ AI Stack), or null if unauthenticated. */
export async function getMyProfile(): Promise<ProfileWithStack | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*, ai_stack_items(*)")
    .eq("id", user.id)
    .order("sort_order", { referencedTable: "ai_stack_items", ascending: true })
    .maybeSingle();
  return (data as ProfileWithStack | null) ?? null;
}

/** True when `handle` is free (optionally excluding the caller's own row). */
export async function isHandleAvailable(
  handle: string,
  excludeId?: string,
): Promise<boolean> {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id")
    .eq("handle", handle.toLowerCase());
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query.maybeSingle();
  return !data;
}

/** Update the caller's own profile (RLS enforces ownership). */
export async function updateProfile(
  input: UpdateProfileInput,
): Promise<ServiceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const patch: TablesUpdate<"profiles"> = {
    handle: input.handle.toLowerCase(),
    display_name: input.display_name,
    bio: input.bio,
    avatar_url: input.avatar_url,
    hire_me_url: input.hire_me_url,
    hire_me_visible: input.hire_me_visible,
  };
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);
  if (error) {
    // 23505 = unique_violation (handle already taken).
    if (error.code === "23505") return { ok: false, error: "handle_taken" };
    return { ok: false, error: "db_error" };
  }
  return { ok: true };
}

/**
 * Replace the caller's AI Stack with `items` (delete-all + insert). RLS scopes
 * both operations to the owner. Not transactional via the JS client, but the
 * list is small and owner-only; an RPC can replace this later if needed.
 */
export async function replaceAiStack(
  profileId: string,
  items: AiStackInput[],
): Promise<ServiceResult> {
  const supabase = await createClient();
  const { error: delError } = await supabase
    .from("ai_stack_items")
    .delete()
    .eq("profile_id", profileId);
  if (delError) return { ok: false, error: "db_error" };

  if (items.length === 0) return { ok: true };

  const rows = items.map((it, i) => ({
    profile_id: profileId,
    tool_name: it.tool_name,
    skill_level: it.skill_level,
    sort_order: it.sort_order ?? i,
  }));
  const { error: insError } = await supabase
    .from("ai_stack_items")
    .insert(rows);
  if (insError) return { ok: false, error: "db_error" };
  return { ok: true };
}
