"use server";

import { revalidatePath } from "next/cache";
import { houseRulesSchema } from "@/lib/profession-rules";
import {
  type HouseRule,
  isProfessionModerator,
  joinProfession,
  leaveProfession,
  pinWorkflow,
  reorderPins,
  unpinWorkflow,
  updateHouseRules,
} from "@/lib/services/professions";

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

/**
 * Story 7.3 — moderator curation actions (pin / unpin / reorder canon, edit house rules). Each
 * RE-ASSERTS `isProfessionModerator` server-side (the action is the trust boundary — never trust the
 * hidden UI; the mod-gated RLS is the DB-level guard underneath). On success we revalidate the
 * dynamic landing route so the rail re-reads. `professionId` is resolved + passed by the (mod-only)
 * rail islands; these actions are unreachable from the member/anon UI (UX-DR21) AND would no-op at the
 * DB for a non-moderator regardless.
 */
async function requireModerator(
  professionId: string,
): Promise<JoinActionResult | null> {
  const isMod = await isProfessionModerator(professionId);
  return isMod ? null : { ok: false, error: "You can't do that here." };
}

export async function pinWorkflowAction(
  professionId: string,
  workflowId: string,
): Promise<JoinActionResult> {
  const denied = await requireModerator(professionId);
  if (denied) return denied;
  const result = await pinWorkflow(professionId, workflowId);
  if (result.ok) {
    revalidatePath("/communities/[slug]", "page");
    return { ok: true };
  }
  return { ok: false, error: "Couldn't pin that workflow." };
}

export async function unpinWorkflowAction(
  professionId: string,
  workflowId: string,
): Promise<JoinActionResult> {
  const denied = await requireModerator(professionId);
  if (denied) return denied;
  const result = await unpinWorkflow(professionId, workflowId);
  if (result.ok) {
    revalidatePath("/communities/[slug]", "page");
    return { ok: true };
  }
  return { ok: false, error: "Couldn't unpin that workflow." };
}

export async function reorderPinsAction(
  professionId: string,
  orderedWorkflowIds: string[],
): Promise<JoinActionResult> {
  const denied = await requireModerator(professionId);
  if (denied) return denied;
  const result = await reorderPins(professionId, orderedWorkflowIds);
  if (result.ok) {
    revalidatePath("/communities/[slug]", "page");
    return { ok: true };
  }
  return { ok: false, error: "Couldn't save the new order." };
}

export async function updateHouseRulesAction(
  professionId: string,
  rules: HouseRule[],
): Promise<JoinActionResult> {
  const denied = await requireModerator(professionId);
  if (denied) return denied;
  // Validate at the boundary (the action is the trust boundary — the 4.2 lesson) with the SAME schema
  // the client form uses; the service re-validates too.
  const parsed = houseRulesSchema.safeParse(rules);
  if (!parsed.success)
    return {
      ok: false,
      error: "Please give every rule a title and a description.",
    };
  const result = await updateHouseRules(professionId, parsed.data);
  if (result.ok) {
    revalidatePath("/communities/[slug]", "page");
    return { ok: true };
  }
  return { ok: false, error: "Couldn't save the rules. Please try again." };
}
