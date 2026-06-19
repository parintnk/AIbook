import "server-only";
import type { ProfileCardData } from "@/lib/follows";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Follows domain/service layer (Story 9.1 / FR21 — the USER half; board-following lives in
 * `boards.ts`). The ONLY place `follows` SQL lives. A near-verbatim clone of the board-follow
 * service: idempotent `upsert`(follow) / `not_found → ok`(unfollow); `follower_id` is auto-stamped
 * by its `default auth.uid()`. The follow GRAPH is public-read (RLS `using(true)`) so the
 * Followers/Following lists render for any viewer; each list row carries the viewer's own
 * follow-state (so they can follow back).
 */

export const FOLLOWS_PAGE_SIZE = 24;

export type FollowResult =
  | { ok: true }
  | { ok: false; error: "not_authenticated" | "db_error" };
export type UnfollowResult =
  | { ok: true }
  | { ok: false; error: "not_authenticated" | "not_found" | "db_error" };

/**
 * Follow a user. Idempotent (`ON CONFLICT DO NOTHING` so a concurrent double-tap converges to one
 * row — never insert-then-23505→db_error). `follower_id` is auto-stamped; RLS enforces "as me, not
 * myself" (a self-follow → RLS/CHECK reject → db_error, but the UI never offers Follow on my own profile).
 */
export async function followUser(targetId: string): Promise<FollowResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("follows")
    .upsert(
      { following_id: targetId },
      { onConflict: "follower_id,following_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: "db_error" };
  return { ok: true };
}

/** Unfollow a user. Zero rows deleted → `not_found` (idempotent — Undo / 2-tabs, the 8.1 lesson). */
export async function unfollowUser(targetId: string): Promise<UnfollowResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("follows")
    .delete()
    .eq("following_id", targetId)
    .eq("follower_id", user.id)
    .select("following_id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

/** Does the signed-in viewer follow `targetId`? False for anon. Powers the Follow button's initial state. */
export async function getFollowState(targetId: string): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return false;
  const { data } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id)
    .eq("following_id", targetId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * The subset of `targetUserIds` the caller follows — drives the per-row Follow/Following state in the
 * lists. Empty Set for anon. Clones `getSavedWorkflowIds` (scoped to MY follow edges).
 */
export async function getFollowingIds(
  targetUserIds: string[],
): Promise<Set<string>> {
  if (targetUserIds.length === 0) return new Set();
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return new Set();
  const { data } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id)
    .in("following_id", targetUserIds);
  return new Set((data ?? []).map((r) => r.following_id));
}

const PROFILE_CARD_SELECT =
  "id, handle, display_name, avatar_url, primary_profession:professions!profiles_primary_profession_fk(name)";

type ProfileCardRow = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  primary_profession: { name: string } | null;
};

/**
 * Enrich an ORDERED list of user ids into `ProfileCardData[]`, preserving the input order (the `.in()`
 * read returns rows in arbitrary order → map back through `orderedIds`). Each row carries the viewer's
 * own follow-state (`isFollowing`). The two-FK `follows` table can't be embedded unambiguously, so we
 * resolve via this 2-step `.in()` (the 5.2 lesson), not a nested self-referential embed.
 */
async function enrichProfiles(
  supabase: SupabaseServerClient,
  orderedIds: string[],
): Promise<ProfileCardData[]> {
  if (orderedIds.length === 0) return [];
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_CARD_SELECT)
    .in("id", orderedIds);
  const rows = (data ?? []) as unknown as ProfileCardRow[];
  const byId = new Map(rows.map((p) => [p.id, p]));
  const followingIds = await getFollowingIds(orderedIds);
  return orderedIds
    .map((id) => byId.get(id))
    .filter((p): p is ProfileCardRow => Boolean(p))
    .map((p) => ({
      id: p.id,
      handle: p.handle,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      professionName: p.primary_profession?.name ?? null,
      isFollowing: followingIds.has(p.id),
    }));
}

/**
 * The users who follow `profileId` (paginated, newest-first). Public-readable (the graph is
 * `using(true)`). `created_at desc, follower_id` is a deterministic offset order (follower_id is
 * unique for a fixed following_id — the 6.1 pagination-tiebreak lesson).
 */
export async function listFollowers(
  profileId: string,
  offset = 0,
  limit = FOLLOWS_PAGE_SIZE,
): Promise<{ items: ProfileCardData[]; total: number }> {
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("follows")
    .select("follower_id", { count: "exact" })
    .eq("following_id", profileId)
    .order("created_at", { ascending: false })
    .order("follower_id", { ascending: false })
    .range(offset, offset + limit - 1);
  const rows = data ?? [];
  if (rows.length === 0) return { items: [], total: count ?? 0 };
  const items = await enrichProfiles(
    supabase,
    rows.map((e) => e.follower_id),
  );
  return { items, total: count ?? rows.length };
}

/** The users `profileId` follows (paginated, newest-first). Public-readable. */
export async function listFollowing(
  profileId: string,
  offset = 0,
  limit = FOLLOWS_PAGE_SIZE,
): Promise<{ items: ProfileCardData[]; total: number }> {
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("follows")
    .select("following_id", { count: "exact" })
    .eq("follower_id", profileId)
    .order("created_at", { ascending: false })
    .order("following_id", { ascending: false })
    .range(offset, offset + limit - 1);
  const rows = data ?? [];
  if (rows.length === 0) return { items: [], total: count ?? 0 };
  const items = await enrichProfiles(
    supabase,
    rows.map((e) => e.following_id),
  );
  return { items, total: count ?? rows.length };
}
