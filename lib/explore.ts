/**
 * Explore / discovery — client-safe types + pure helpers (Story 6.1).
 *
 * This module is intentionally NOT `server-only`: `WorkflowCardData` and the pure
 * helpers below are consumed by client components (`WorkflowCard`, `ExploreFeed`),
 * so they must live outside the `server-only` service layer (the 5.3 server/client
 * split lesson). The service (`lib/services/workflows.ts`) imports `WorkflowCardData`
 * from here and is the only place that touches Supabase.
 */

/** Output kinds that can back a feed-card thumbnail (mirrors `node_outputs.kind`). */
export type ThumbKind = "image" | "video" | "text" | "file";

/** A workflow rendered as a feed card — flat + serializable (crosses the RSC→client boundary). */
export type WorkflowCardData = {
  id: string;
  title: string;
  authorHandle: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  professionName: string | null;
  professionSlug: string | null;
  forkCount: number;
  workedScore: number;
  triedCount: number;
  publishedAt: string | null;
  /** The card thumbnail: a real image when available, else a kind for the wash/kit fallback. */
  thumb: { kind: ThumbKind | null; url: string | null };
  /** Whether the signed-in viewer has this workflow in ≥1 of their boards (Story 8.1 savemark
   *  fill). Set by the page / Load-more action via getSavedWorkflowIds; absent/false for anon. */
  saved?: boolean;
};

/**
 * Feed sort. `trending` = Hot (most-forked, recency tiebreak — or, on a community feed that opts in
 * via `hotBlend`, a recency-weighted engagement blend); `new` = recency; `top` = all-time worked-%/forks.
 */
export type WorkflowSort = "trending" | "new" | "top";

/**
 * A curated tag (Story 6.2 / FR3 filter facet). Client-safe — the editor tag picker
 * and the profession landing page's filter-chip row both import it, so (like
 * `WorkflowCardData`) it lives here, not in the `server-only` service layer.
 */
export type Tag = { id: string; slug: string; label: string };

/** Feed page size — offset pagination. (The mockup's literal "6" is illustrative; 12 = 4×3.) */
export const PAGE_SIZE = 12;

/**
 * Worked-rate as a whole percentage, or null when there are no tried votes yet.
 * `worked_score` is the weighted SUCCESS COUNT (`worked + 0.5*tweaked`) and `tried_count`
 * is the total tries (`worked+tweaked+failed`) — both from the Epic-4 recompute trigger
 * (`20260617000001_outcome_votes.sql`). The rate is `worked_score / tried_count`, ×100 for
 * a percentage. (Earlier this multiplied the count by 100 directly — correct only because
 * seed data hand-set `worked_score` as a 0–1 ratio; real votes store a count, so the
 * division is required. Keep `worked_score` a COUNT, not a rate, so the `top` sort's
 * secondary key stays count-based and one lone "worked" vote can't rocket a row to #1.)
 */
export function workedPct(
  workedScore: number,
  triedCount: number,
): number | null {
  return triedCount > 0 ? Math.round((workedScore / triedCount) * 100) : null;
}

/** The 6 thumbnail wash keys (the mockup's `t-*` palette), in order. */
export const THUMB_WASHES = [
  "violet",
  "teal",
  "rose",
  "amber",
  "indigo",
  "slate",
] as const;
export type ThumbWash = (typeof THUMB_WASHES)[number];

/**
 * Deterministic wash per workflow id so a card looks the same across renders without a
 * stored cover image (same hash as `lineage-wash.ts`, kept local so this stays RF-free).
 */
export function thumbWash(id: string): ThumbWash {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return THUMB_WASHES[h % THUMB_WASHES.length];
}

/** Decorative kit for a thumbnail fallback, chosen by the output kind. */
export function thumbKit(
  kind: ThumbKind | null,
): "doc" | "logo" | "video" | "sheet" {
  switch (kind) {
    case "image":
      return "logo";
    case "video":
      return "video";
    case "file":
      return "sheet";
    default:
      return "doc"; // text / unknown
  }
}

/** Short label for the `output · {label}` thumbnail tag. */
export function thumbLabel(kind: ThumbKind | null): string {
  return kind ?? "recipe";
}
