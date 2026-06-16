"use server";

import {
  PAGE_SIZE,
  type WorkflowCardData,
  type WorkflowSort,
} from "@/lib/explore";
import { listPublishedWorkflows } from "@/lib/services/workflows";

/**
 * Fetch the next page of the Explore feed for the in-place "Load more" append (UX-DR17).
 * Preserves the active `sort` + `profession` so pagination stays within the current view.
 * Public — `listPublishedWorkflows` is RLS-only (no auth gate).
 */
export async function loadMoreWorkflowsAction(input: {
  sort: WorkflowSort;
  profession: string | null;
  offset: number;
}): Promise<{ items: WorkflowCardData[]; total: number }> {
  return listPublishedWorkflows({
    sort: input.sort,
    profession: input.profession,
    offset: input.offset,
    limit: PAGE_SIZE,
  });
}
