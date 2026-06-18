import type { WorkflowCardData } from "@/lib/explore";

/**
 * Client-safe semantic-search types + helpers (Story 10.2). Like `lib/explore.ts`, these live OUTSIDE
 * the `server-only` service layer so the `/search` client components (result cards, sort tabs, the
 * query box, keyword highlighting) can import them without pulling the service in.
 */

/** Result sort (mockup `.resbar`): relevance (default) · most-forked · newest. */
export type SearchSort = "best" | "forked" | "new";

export const SEARCH_SORTS: SearchSort[] = ["best", "forked", "new"];

/** Map a `?sort=` searchParam to a `SearchSort` (unknown → "best"). */
export function parseSearchSort(value: string | null | undefined): SearchSort {
  return value === "forked" || value === "new" ? value : "best";
}

/** A search result card = a feed card + an optional relevance % (semantic only; null for keyword). */
export type SearchResultCard = WorkflowCardData & { matchPct?: number | null };

/**
 * A page of search results. `degraded` = the embedding service was unavailable and these are
 * Postgres FTS keyword matches (Story 10.3, absorbed) under the "Semantic search is resting" note —
 * NOT an error, NOT empty (FR2 "done-when"). `total === 0 && !degraded` = the AC2 empty state.
 */
export type SearchResult = {
  items: SearchResultCard[];
  total: number;
  degraded: boolean;
};

/** Build a `/search` href, preserving the query + toggled filters (the shareable URL-state, DR-5). */
export function buildSearchHref(params: {
  q: string;
  profession?: string | null;
  tag?: string | null;
  sort?: SearchSort;
}): string {
  const sp = new URLSearchParams();
  sp.set("q", params.q);
  if (params.profession) sp.set("profession", params.profession);
  if (params.tag) sp.set("tag", params.tag);
  if (params.sort && params.sort !== "best") sp.set("sort", params.sort);
  return `/search?${sp.toString()}`;
}

/**
 * Split `text` into segments, flagging the spans that match a query term (≥2 chars) so the keyword
 * fallback can wrap them in `<mark>` (the mockup `.kwrow mark`). Pure + case-insensitive.
 */
export function highlightTerms(
  text: string,
  query: string,
): Array<{ t: string; mark: boolean }> {
  const terms = [
    ...new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 2),
    ),
  ];
  if (terms.length === 0) return [{ t: text, mark: false }];
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const out: Array<{ t: string; mark: boolean }> = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: text.slice(last, i), mark: false });
    out.push({ t: m[0], mark: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), mark: false });
  return out.length ? out : [{ t: text, mark: false }];
}
