import "server-only";
import { cache } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";

/**
 * Outcome-votes domain/service layer (DR-1, Story 4.1 / FR11) — the ONLY place
 * outcome_votes SQL lives. A viewer holds at most one (changeable) vote per published
 * workflow (UNIQUE(workflow_id, voter_id)). Votes are PRIVATE (RLS: own-vote-only);
 * the public signal is the denormalized tally on workflows, maintained by a SECURITY
 * DEFINER recompute trigger — this layer never writes those counters.
 *
 * Writes are RLS-bound on the user-session client (voter_id defaults to auth.uid()
 * and the RLS with-check pins it; insert is gated on the workflow being published).
 * `castOutcomeVote` upserts on the UNIQUE key so re-voting changes the verdict.
 */

export type OutcomeVote = Tables<"outcome_votes">;
export type OutcomeVerdict = OutcomeVote["verdict"];

export type OutcomeVoteResult =
  | { ok: true }
  | { ok: false; error: "not_authenticated" | "db_error" };

/** The caller's own vote on a workflow, or null (incl. anon). RLS-gated (own-only). */
export const getMyOutcomeVote = cache(
  async (workflowId: string): Promise<OutcomeVote | null> => {
    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) return null;
    const { data } = await supabase
      .from("outcome_votes")
      .select("*")
      .eq("workflow_id", workflowId)
      .eq("voter_id", user.id)
      .maybeSingle();
    return data ?? null;
  },
);

/**
 * Cast or change the caller's outcome vote. Upsert on UNIQUE(workflow_id, voter_id)
 * so a second vote updates the verdict. RLS enforces own-vote + published-only; the
 * recompute trigger updates the workflow's denormalized counters. `voter_id` is set
 * explicitly (defense-in-depth atop the column default + the RLS with-check).
 */
export async function castOutcomeVote(
  workflowId: string,
  verdict: OutcomeVerdict,
  note?: string | null,
): Promise<OutcomeVoteResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase.from("outcome_votes").upsert(
    {
      workflow_id: workflowId,
      voter_id: user.id,
      verdict,
      note: note ?? null,
    },
    { onConflict: "workflow_id,voter_id" },
  );
  if (error) return { ok: false, error: "db_error" };
  return { ok: true };
}
