import "server-only";
import { cache } from "react";
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";

/**
 * Profiles domain/service layer (architecture DR-1 — extract-later guardrail).
 * This is the ONLY place profile/ai_stack SQL lives; routes, pages, and server
 * actions call these functions instead of querying Supabase directly.
 */

export type Profile = Tables<"profiles">;
export type AiStackItem = Tables<"ai_stack_items">;
export type PrimaryProfession = { slug: string; name: string } | null;
export type ProfileWithStack = Profile & {
  ai_stack_items: AiStackItem[];
  primary_profession: PrimaryProfession;
};

export type UpdateProfileInput = {
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  hire_me_url: string | null;
  hire_me_visible: boolean;
  primary_profession_id: string | null;
};

// Disambiguate the profiles→professions relationship (there are two: the direct
// primary_profession FK and the many-to-many via profession_members) by naming
// the FK constraint explicitly.
const PROFILE_SELECT =
  "*, ai_stack_items(*), primary_profession:professions!profiles_primary_profession_fk(slug, name)";

export type AiStackInput = {
  tool_name: string;
  skill_level: number;
  sort_order: number;
};

export type ServiceResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "handle_taken"
        | "not_authenticated"
        | "not_found"
        | "invalid_profession"
        | "db_error";
    };

/**
 * Public read: a profile by handle, with its AI Stack ordered. Null if absent.
 * `cache()`-wrapped so `generateMetadata` + the page component share one query
 * within a request.
 */
export const getProfileByHandle = cache(
  async (handle: string): Promise<ProfileWithStack | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("handle", handle.toLowerCase())
      .order("sort_order", {
        referencedTable: "ai_stack_items",
        ascending: true,
      })
      .maybeSingle();
    return (data as ProfileWithStack | null) ?? null;
  },
);

/** The signed-in user's own profile (+ AI Stack), or null if unauthenticated. */
export async function getMyProfile(): Promise<ProfileWithStack | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
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
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const patch: TablesUpdate<"profiles"> = {
    handle: input.handle.toLowerCase(),
    display_name: input.display_name,
    bio: input.bio,
    avatar_url: input.avatar_url,
    hire_me_url: input.hire_me_url,
    hire_me_visible: input.hire_me_visible,
    primary_profession_id: input.primary_profession_id,
  };
  // `.select()` so we can tell a real update from a no-op: a Postgres UPDATE
  // matching zero rows is NOT an error, so without this a profile-less user
  // would get a false success.
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    // 23505 = unique_violation (handle already taken).
    if (error.code === "23505") return { ok: false, error: "handle_taken" };
    // 23503 = foreign_key_violation (primary_profession_id isn't a real profession).
    if (error.code === "23503")
      return { ok: false, error: "invalid_profession" };
    return { ok: false, error: "db_error" };
  }
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Replace the caller's AI Stack atomically via the `replace_ai_stack` RPC
 * (single Postgres transaction — delete + insert can't half-apply and wipe the
 * stack). RLS scopes it to the owner (auth.uid()).
 */
export async function replaceAiStack(
  items: AiStackInput[],
): Promise<ServiceResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("replace_ai_stack", {
    items: items.map((it, i) => ({
      tool_name: it.tool_name,
      skill_level: it.skill_level,
      sort_order: it.sort_order ?? i,
    })),
  });
  if (error) return { ok: false, error: "db_error" };
  return { ok: true };
}

/**
 * True when the user is a `verified_pro` in ANY profession — drives the verified badge on the profile
 * hero (Story 9.1). DERIVED (a `profession_members` read), NOT a profiles column. Public-read.
 */
export async function isVerifiedCreator(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profession_members")
    .select("profession_id")
    .eq("profile_id", userId)
    .eq("role", "verified_pro")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}
