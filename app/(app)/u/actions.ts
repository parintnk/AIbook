"use server";

import { revalidatePath } from "next/cache";
import type { ProfileCardData } from "@/lib/follows";
import {
  followUser,
  listFollowers,
  listFollowing,
  unfollowUser,
} from "@/lib/services/follows";

/**
 * Follow Server Actions (Story 9.1 / FR21). Auth + the no-self-follow invariant are enforced in the
 * service + RLS; these map Results to friendly copy and revalidate the TARGET's profile so its SSR
 * follower_count stays honest. The optimistic island owns the immediate visual (button flip + count).
 * The follower's OWN following_count (on their profile) is eventually consistent — we don't fan-out
 * revalidate it on every follow.
 */

type ActionResult = { ok: true } | { ok: false; error: string };
export type LoadProfilesResult = { items: ProfileCardData[]; total: number };

export async function followUserAction(
  targetId: string,
  targetHandle: string,
): Promise<ActionResult> {
  const res = await followUser(targetId);
  if (res.ok) {
    revalidatePath(`/u/${targetHandle}`);
    return { ok: true };
  }
  if (res.error === "not_authenticated")
    return { ok: false, error: "Sign in to follow." };
  return { ok: false, error: "Couldn't follow. Please try again." };
}

export async function unfollowUserAction(
  targetId: string,
  targetHandle: string,
): Promise<ActionResult> {
  const res = await unfollowUser(targetId);
  // `not_found` = already not following → the desired end-state holds → idempotent success (the 8.1
  // removeFromBoard lesson; failing it would make the optimistic button revert under an Undo/2-tab race).
  if (res.ok || res.error === "not_found") {
    revalidatePath(`/u/${targetHandle}`);
    return { ok: true };
  }
  if (res.error === "not_authenticated")
    return { ok: false, error: "Sign in to follow." };
  return { ok: false, error: "Couldn't unfollow. Please try again." };
}

/** Append the next page of a profile's followers (the Followers dialog "Load more"). */
export async function loadMoreFollowersAction(
  profileId: string,
  offset: number,
): Promise<LoadProfilesResult> {
  return listFollowers(profileId, offset);
}

/** Append the next page of who a profile follows (the Following dialog "Load more"). */
export async function loadMoreFollowingAction(
  profileId: string,
  offset: number,
): Promise<LoadProfilesResult> {
  return listFollowing(profileId, offset);
}
