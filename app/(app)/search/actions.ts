"use server";

import { PAGE_SIZE } from "@/lib/explore";
import type { SearchResultCard, SearchSort } from "@/lib/search";
import { getSavedWorkflowIds } from "@/lib/services/boards";
import { searchWorkflows } from "@/lib/services/search";

/**
 * Next page of semantic search results for the in-place "Load more" append (mockup "Showing X of Y").
 * Re-runs `searchWorkflows` at the next offset — the query embedding is cached so this is cheap, and
 * the bounded-window sort is deterministic → consistent pages. Threads the resolved `professionId` /
 * `tagIds` (NOT slugs) the page already validated. The per-card `saved` flag (Story 8.1) is enriched
 * here so appended cards show the correct bookmark state (empty for anon).
 */
export async function loadMoreSearchAction(input: {
  query: string;
  professionId: string | null;
  tagIds: string[] | null;
  sort: SearchSort;
  offset: number;
}): Promise<{ items: SearchResultCard[]; total: number; degraded: boolean }> {
  const res = await searchWorkflows({
    query: input.query,
    professionId: input.professionId,
    tagIds: input.tagIds,
    sort: input.sort,
    offset: input.offset,
    limit: PAGE_SIZE,
  });
  const savedIds = await getSavedWorkflowIds(res.items.map((i) => i.id));
  return {
    items: res.items.map((i) => ({ ...i, saved: savedIds.has(i.id) })),
    total: res.total,
    // Surfaced so the client paginator never splices a mid-session keyword-fallback page (different
    // ranking, no matchPct, possible dup ids) into the semantic grid — see SearchResults.loadMore.
    degraded: res.degraded,
  };
}
