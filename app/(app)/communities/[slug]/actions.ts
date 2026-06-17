"use server";

import { revalidatePath } from "next/cache";
import { joinProfession, leaveProfession } from "@/lib/services/professions";

/**
 * Join / leave a profession (Story 6.2 / FR18). The service does the RLS-bound
 * insert/delete (self-join as `member`, self-leave); the `sync_member_count()`
 * trigger maintains `member_count`. We revalidate the dynamic landing route so the
 * member-count + Joined state re-read after a non-optimistic fallback / hard refresh
 * (the JoinButton also updates optimistically). `professionId` is the trust boundary;
 * the slug isn't needed (we revalidate the route template).
 */
type JoinActionResult = { ok: true } | { ok: false; error: string };

export async function joinProfessionAction(
  professionId: string,
): Promise<JoinActionResult> {
  const result = await joinProfession(professionId);
  if (result.ok) {
    revalidatePath("/communities/[slug]", "page");
    return { ok: true };
  }
  if (result.error === "not_authenticated")
    return { ok: false, error: "Sign in to join." };
  return { ok: false, error: "Couldn't join. Please try again." };
}

export async function leaveProfessionAction(
  professionId: string,
): Promise<JoinActionResult> {
  const result = await leaveProfession(professionId);
  if (result.ok) {
    revalidatePath("/communities/[slug]", "page");
    return { ok: true };
  }
  if (result.error === "not_authenticated")
    return { ok: false, error: "Sign in to join." };
  // A moderator / verified_pro can't self-leave (RLS) → zero-row delete → not_found.
  if (result.error === "not_found")
    return { ok: false, error: "You can't leave this community." };
  return { ok: false, error: "Couldn't update membership. Please try again." };
}
