import type { WorkflowSort } from "@/lib/explore";

/**
 * Build a `/communities/{slug}` URL preserving the active sort + tag (Story 6.2). The
 * defaults — `trending` sort and no tag — are omitted from the query so canonical URLs
 * stay clean and shareable.
 */
export function communityHref(
  slug: string,
  sort: WorkflowSort,
  tag: string | null,
): string {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  if (sort === "new") params.set("sort", "new");
  const qs = params.toString();
  return `/communities/${slug}${qs ? `?${qs}` : ""}`;
}
