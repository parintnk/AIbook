import "server-only";
import { cache } from "react";
import type { Tag } from "@/lib/explore";
import { createClient } from "@/lib/supabase/server";

/**
 * Tags domain/service layer (DR-1) — the only place tag SQL lives (Story 6.2 / FR3).
 * Tags are a curated, seeded set (no client writes); authors attach/detach them on
 * their own workflows via `workflow_tags` (the workflows service owns those writes).
 * Reads are public (RLS `using(true)`) — no auth gate, so anon visitors see the
 * profession landing page's tag-filter chips.
 */

/** All curated tags, label-sorted — the editor tag picker's option list. */
export const listTags = cache(async (): Promise<Tag[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tags")
    .select("id, slug, label")
    .order("label", { ascending: true });
  return (data as Tag[] | null) ?? [];
});

/**
 * The distinct tags present on a profession's PUBLISHED workflows — the landing
 * page's filter-chip row. Three batched reads (public/RLS-only): the profession's
 * published workflow ids → their `workflow_tags` → the tag rows. Returns `[]` for
 * an unknown slug or a profession whose published work carries no tags (→ no chips).
 */
export async function listProfessionTags(
  professionSlug: string,
): Promise<Tag[]> {
  const supabase = await createClient();

  const { data: prof } = await supabase
    .from("professions")
    .select("id")
    .eq("slug", professionSlug)
    .maybeSingle();
  const professionId = (prof as { id: string } | null)?.id ?? null;
  if (!professionId) return [];

  const { data: wfRows } = await supabase
    .from("workflows")
    .select("id")
    .eq("status", "published")
    .eq("profession_id", professionId);
  const workflowIds = (wfRows ?? []).map((w) => (w as { id: string }).id);
  if (workflowIds.length === 0) return [];

  const { data: links } = await supabase
    .from("workflow_tags")
    .select("tag_id")
    .in("workflow_id", workflowIds);
  const tagIds = [
    ...new Set((links ?? []).map((l) => (l as { tag_id: string }).tag_id)),
  ];
  if (tagIds.length === 0) return [];

  const { data: tags } = await supabase
    .from("tags")
    .select("id, slug, label")
    .in("id", tagIds)
    .order("label", { ascending: true });
  return (tags as Tag[] | null) ?? [];
}

/**
 * The published-workflow ids carrying tag `slug` — the feed's tag filter (one slug→id
 * lookup + one join read). Takes the caller's RLS client so it shares the request's
 * session. Returns `[]` for an unknown tag → the caller short-circuits to an empty
 * feed (a real "no matches", NOT the unfiltered feed).
 */
export async function workflowIdsForTag(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tagSlug: string,
): Promise<string[]> {
  const { data: tag } = await supabase
    .from("tags")
    .select("id")
    .eq("slug", tagSlug)
    .maybeSingle();
  const tagId = (tag as { id: string } | null)?.id ?? null;
  if (!tagId) return [];

  const { data: links } = await supabase
    .from("workflow_tags")
    .select("workflow_id")
    .eq("tag_id", tagId);
  return (links ?? []).map((l) => (l as { workflow_id: string }).workflow_id);
}
