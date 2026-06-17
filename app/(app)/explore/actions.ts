"use server";

import {
  PAGE_SIZE,
  type WorkflowCardData,
  type WorkflowSort,
} from "@/lib/explore";
import { listPublishedWorkflows } from "@/lib/services/workflows";

/**
 * Fetch the next page of the Explore / community feed for the in-place "Load more" append
 * (UX-DR17). Preserves the active `sort` + `profession` + `tag` so pagination stays within
 * the current view. Public — `listPublishedWorkflows` is RLS-only (no auth gate).
 */
export async function loadMoreWorkflowsAction(input: {
  sort: WorkflowSort;
  profession: string | null;
  tag?: string | null;
  offset: number;
  /** Community Hot blend (Story 7.1) — forwarded so a community feed's Load more keeps the
   *  recency-weighted ranking + its SSR reference time. Omitted by /explore (column sort). */
  hotBlend?: boolean;
  asOf?: string;
}): Promise<{ items: WorkflowCardData[]; total: number }> {
  return listPublishedWorkflows({
    sort: input.sort,
    profession: input.profession,
    tag: input.tag ?? null,
    offset: input.offset,
    limit: PAGE_SIZE,
    hotBlend: input.hotBlend,
    asOf: input.asOf,
  });
}
