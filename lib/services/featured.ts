import "server-only";
import type { WorkflowCardData } from "@/lib/explore";
import { createClient } from "@/lib/supabase/server";
import {
  CARD_SELECT,
  type PublishedCardRow,
  resolveThumbs,
  toCardData,
} from "./workflows";

/**
 * Featured / "Workflow of the Day" service (Story 6.3 / FR5 / UX-DR16). Server-only;
 * reads the curated `daily_featured` table + the featured published workflow. The
 * ONLY place WOTD SQL lives. Public — RLS (`daily_featured` public-read + the workflow
 * `status='published'`) is the boundary, like `listPublishedWorkflows`.
 */

/**
 * The Workflow of the Day for the hero: a feed-card shape + the step count + the
 * feature date. `professionName`/`professionSlug` are the featured workflow's own
 * profession (non-null in practice for a real feature).
 */
export type WotdData = WorkflowCardData & {
  stepCount: number;
  featureDate: string;
};

type FeatureCandidate = {
  feature_date: string;
  profession_id: string;
  workflow_id: string;
};

/** Today as an ISO `date` string (UTC) for the `feature_date <= today` filter. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The current "Workflow of the Day" for a discovery surface (Story 6.3 / FR5 / UX-DR16).
 * Public — NO auth gate; RLS is the boundary (`daily_featured` is public-read and the
 * workflow must be `status='published'`). Picks the most recent curated feature
 * (`feature_date <= today`) whose workflow is STILL published — a curated row pointing at
 * an unpublished / deleted workflow is skipped (never a broken hero), falling through to
 * the next-most-recent published feature (cold-start mitigation). `professionId` scopes to
 * one profession (the community page); omitted = the "profession of the day" across all
 * professions (Explore home). Returns null when nothing is curated → the caller renders
 * no hero (no empty stub).
 *
 * v1 rotation is deterministic-simple (most recent feature wins; same-date ties broken by
 * profession_id). True per-day cross-profession auto-rotation is the documented Cron /
 * Edge-Function path (AR7), NOT built here.
 */
export async function getWorkflowOfTheDay(opts?: {
  professionId?: string;
}): Promise<WotdData | null> {
  const professionId = opts?.professionId ?? null;
  const supabase = await createClient();

  // Step 1 — the most recent curated features (today or earlier), most-recent first. A small
  // window (not just limit 1) so an unpublished/deleted target falls through to the next
  // published feature rather than blanking the hero.
  let candidateQuery = supabase
    .from("daily_featured")
    .select("feature_date, profession_id, workflow_id")
    .lte("feature_date", today());
  if (professionId) {
    candidateQuery = candidateQuery.eq("profession_id", professionId);
  }
  const { data: candData } = await candidateQuery
    .order("feature_date", { ascending: false })
    .order("profession_id", { ascending: true })
    .limit(10);
  const candidates = (candData ?? []) as FeatureCandidate[];
  if (candidates.length === 0) return null;

  // Step 2 — the PUBLISHED workflows among the candidates (CARD_SELECT + the step count). A
  // featured draft/unpublished workflow is filtered out here (status='published').
  const workflowIds = [...new Set(candidates.map((c) => c.workflow_id))];
  const { data: wfData } = await supabase
    .from("workflows")
    .select(`${CARD_SELECT}, workflow_nodes(count)`)
    .eq("status", "published")
    .in("id", workflowIds);
  const rows = (wfData ?? []) as Array<
    PublishedCardRow & { workflow_nodes: { count: number }[] }
  >;
  if (rows.length === 0) return null;
  const rowById = new Map(rows.map((r) => [r.id, r]));

  // First candidate (most-recent precedence) whose workflow is published.
  const pick = candidates.find((c) => rowById.has(c.workflow_id));
  const row = pick ? rowById.get(pick.workflow_id) : undefined;
  if (!pick || !row) return null;

  const thumbs = await resolveThumbs(supabase, [row.id]);
  const card = toCardData(row, thumbs.get(row.id) ?? { kind: null, url: null });
  return {
    ...card,
    stepCount: row.workflow_nodes?.[0]?.count ?? 0,
    featureDate: pick.feature_date,
  };
}
