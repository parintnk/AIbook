import "server-only";
import { cache } from "react";
import {
  PAGE_SIZE,
  type ThumbKind,
  type WorkflowCardData,
  type WorkflowSort,
} from "@/lib/explore";
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { deriveThumbPath } from "./node-outputs";
import { createSupabaseStorage } from "./storage/supabase-storage";
import { workflowIdsForTag } from "./tags";

/**
 * Workflows domain/service layer (DR-1) — the ONLY place workflow SQL lives.
 * Story 2.1 ships draft CRUD; nodes/edges/outputs/publish are Stories 2.2-2.5.
 * RLS enforces ownership (drafts are private to author_id); these functions
 * additionally scope every query to the caller + status='draft' so a caller can
 * only ever touch their own drafts.
 */

export type Workflow = Tables<"workflows">;
export type DraftListItem = Workflow & {
  profession: { slug: string; name: string } | null;
};

/** A fork in the caller's "My forks" list (Story 5.2) — the fork row + its parent's title/@handle
 * for the "Forked from @x" lineage link. */
export type MyForkListItem = Workflow & {
  profession: { slug: string; name: string } | null;
  parent: {
    id: string;
    title: string;
    status: string;
    author: { handle: string } | null;
  } | null;
};

/** A published workflow for the public viewer (Story 3.1) — joins the author. */
export type PublishedWorkflow = Workflow & {
  profession: { slug: string; name: string } | null;
  author: {
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export type DraftInput = {
  title: string;
  summary: string | null;
  profession_id: string;
  /** Selected tag ids (Story 6.2). Replace-set on save; [] clears all tags. */
  tags: string[];
};

/** A single draft with its current tag ids, for the edit form's defaults (Story 6.2). */
export type DraftDetail = DraftListItem & { tagIds: string[] };

export type WorkflowResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "not_found"
        | "invalid_profession"
        | "db_error";
    };

/** A node that still lacks a sample output, blocking publish (FR10). */
export type PublishMissingNode = { id: string; idx: number };

/**
 * Publish carries a `missing` node list on the gate failure, which the generic
 * `WorkflowResult` can't. `not_found` covers both "not your draft" and "already
 * published" (the RPC's single 42501 path); `missing_outputs`/`no_nodes` are the
 * FR10/FR9 gate rejections.
 */
export type PublishResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "not_found"
        | "missing_outputs"
        | "no_nodes"
        | "db_error";
      missing?: PublishMissingNode[];
    };

export type ForkResult =
  | { ok: true; forkId: string }
  | { ok: false; error: "not_authenticated" | "invalid_source" | "db_error" };

/**
 * Every `workflows` column EXCEPT the heavy `search_vector` tsvector. No UI consumer
 * reads `search_vector` (only the search service does, via its own query), yet `*` drags
 * it on every row — wasteful on draft/fork lists + the viewer. Listing the columns
 * explicitly drops it. (The narrow `CARD_SELECT` already excludes it for feed cards.)
 */
const WORKFLOW_COLS =
  "author_id, created_at, failed_count, fork_count, id, last_verified_at, parent_id, profession_id, published_at, status, summary, title, tried_count, tweaked_count, updated_at, worked_count, worked_score";

const DRAFT_SELECT = `${WORKFLOW_COLS}, profession:professions!workflows_profession_id_fkey(slug, name)`;

const PUBLISHED_SELECT = `${WORKFLOW_COLS}, profession:professions!workflows_profession_id_fkey(slug, name), author:profiles!workflows_author_id_fkey(handle, display_name, avatar_url)`;

const FORK_LIST_SELECT = `${WORKFLOW_COLS}, profession:professions!workflows_profession_id_fkey(slug, name)`;

/** The caller's own draft workflows, newest-updated first. RLS scopes to author. */
export const listMyDrafts = cache(async (): Promise<DraftListItem[]> => {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase
    .from("workflows")
    .select(DRAFT_SELECT)
    .eq("author_id", user.id)
    .eq("status", "draft")
    .order("updated_at", { ascending: false });
  return (data as DraftListItem[] | null) ?? [];
});

/**
 * The caller's FORKS (workflows I authored that have a `parent_id`), newest-updated first — both
 * draft AND published (the row branches Edit/View on status). Each embeds the parent's title +
 * author `@handle` for the "Forked from @x" lineage link (Story 5.2 / FR15). RLS scopes the rows
 * to the author; the published parent embeds inline, an unreadable parent → `null` (graceful).
 */
export const listMyForks = cache(async (): Promise<MyForkListItem[]> => {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  // My forks (draft + published), newest-updated first.
  const { data } = await supabase
    .from("workflows")
    .select(FORK_LIST_SELECT)
    .eq("author_id", user.id)
    .not("parent_id", "is", null)
    .order("updated_at", { ascending: false });
  const forks = (data ?? []) as Array<
    Workflow & { profession: { slug: string; name: string } | null }
  >;
  if (forks.length === 0) return [];

  // Enrich each fork with its parent's title + author @handle in ONE batch query (reusing the
  // `author:profiles!workflows_author_id_fkey(handle)` embed getForkParentHandle uses — NOT a
  // self-referential nested embed). Not N+1. Filter to PUBLISHED parents for parity with
  // getForkParentHandle: the lineage link targets the public `/workflows/{id}` detail, so a
  // non-published parent (e.g. a fork of my own source I later unpublish) resolves to `null` and
  // the row omits the link — never a dead link to a draft.
  const parentIds = [
    ...new Set(
      forks.map((f) => f.parent_id).filter((id): id is string => id != null),
    ),
  ];
  const parentMap = new Map<
    string,
    {
      id: string;
      title: string;
      status: string;
      author: { handle: string } | null;
    }
  >();
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from("workflows")
      .select(
        "id, title, status, author:profiles!workflows_author_id_fkey(handle)",
      )
      .eq("status", "published")
      .in("id", parentIds);
    for (const p of (parents ?? []) as Array<{
      id: string;
      title: string;
      status: string;
      author: { handle: string } | null;
    }>) {
      parentMap.set(p.id, p);
    }
  }

  return forks.map(
    (f): MyForkListItem => ({
      ...f,
      parent: f.parent_id ? (parentMap.get(f.parent_id) ?? null) : null,
    }),
  );
});

/** A single draft the caller owns (+ its tag ids for the edit form), or null. RLS +
 * the filters enforce ownership. */
export const getMyDraft = cache(
  async (id: string): Promise<DraftDetail | null> => {
    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) return null;
    const { data } = await supabase
      .from("workflows")
      .select(`${DRAFT_SELECT}, workflow_tags(tag_id)`)
      .eq("id", id)
      .eq("author_id", user.id)
      .eq("status", "draft")
      .maybeSingle();
    if (!data) return null;
    const { workflow_tags, ...rest } = data as DraftListItem & {
      workflow_tags: { tag_id: string }[] | null;
    };
    return {
      ...(rest as DraftListItem),
      tagIds: (workflow_tags ?? []).map((t) => t.tag_id),
    };
  },
);

/**
 * A single PUBLISHED workflow for the public detail viewer (Story 3.1 / FR6).
 * NO auth guard — RLS (`status='published' OR author`) is the boundary, and a
 * signed-out visitor must be able to read it. A draft / nonexistent / other id
 * resolves to null (RLS hides it) → the route calls notFound().
 */
export const getPublishedWorkflow = cache(
  async (id: string): Promise<PublishedWorkflow | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("workflows")
      .select(PUBLISHED_SELECT)
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    return (data as PublishedWorkflow | null) ?? null;
  },
);

/**
 * The `@handle` of a published fork's PARENT author (Story 5.1 AC3 attribution).
 * Returns null when the parent is no longer published / readable (parent_id's
 * on-delete-set-null, or an unpublished parent) → the trust row falls back.
 */
export const getForkParentHandle = cache(
  async (parentId: string): Promise<string | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("workflows")
      .select("author:profiles!workflows_author_id_fkey(handle)")
      .eq("id", parentId)
      .eq("status", "published")
      .maybeSingle();
    const author = (data as { author: { handle: string } | null } | null)
      ?.author;
    return author?.handle ?? null;
  },
);

/** The columns a feed card needs (counters + embedded profession + author). */
export const CARD_SELECT =
  "id, title, fork_count, worked_score, tried_count, published_at, profession:professions!workflows_profession_id_fkey(slug, name), author:profiles!workflows_author_id_fkey(handle, display_name, avatar_url)";

export type PublishedCardRow = {
  id: string;
  title: string;
  fork_count: number;
  worked_score: number;
  tried_count: number;
  published_at: string | null;
  profession: { slug: string; name: string } | null;
  author: {
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export function toCardData(
  r: PublishedCardRow,
  thumb: { kind: ThumbKind | null; url: string | null },
): WorkflowCardData {
  return {
    id: r.id,
    title: r.title,
    authorHandle: r.author?.handle ?? null,
    authorDisplayName: r.author?.display_name ?? null,
    authorAvatarUrl: r.author?.avatar_url ?? null,
    professionName: r.profession?.name ?? null,
    professionSlug: r.profession?.slug ?? null,
    forkCount: r.fork_count,
    workedScore: r.worked_score,
    triedCount: r.tried_count,
    publishedAt: r.published_at,
    thumb,
  };
}

/**
 * The thumbnail (output preview) for each workflow on a feed page, derived in TWO batched
 * queries (the `listMyForks` 2-step `.in()` pattern — NOT N+1, NOT a self-ref embed): the
 * first node (idx 0) per workflow, then that node's output. An image output resolves to a
 * signed thumb URL (private bucket); every other kind carries only its `kind` for the
 * wash/kit fallback. A workflow whose node/output can't be read → `{kind:null,url:null}`
 * (graceful — the card falls back to a deterministic wash).
 */
export async function resolveThumbs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workflowIds: string[],
): Promise<Map<string, { kind: ThumbKind | null; url: string | null }>> {
  const result = new Map<
    string,
    { kind: ThumbKind | null; url: string | null }
  >();
  if (workflowIds.length === 0) return result;

  // Step 1 — the first node (idx 0) per workflow. `.eq("idx", 0)` BEFORE `.in()` (the mock terminal).
  const { data: nodes } = await supabase
    .from("workflow_nodes")
    .select("id, workflow_id")
    .eq("idx", 0)
    .in("workflow_id", workflowIds);
  const firstNodeByWorkflow = new Map<string, string>();
  const nodeIds: string[] = [];
  for (const n of (nodes ?? []) as Array<{ id: string; workflow_id: string }>) {
    if (!firstNodeByWorkflow.has(n.workflow_id)) {
      firstNodeByWorkflow.set(n.workflow_id, n.id);
      nodeIds.push(n.id);
    }
  }
  if (nodeIds.length === 0) return result;

  // Step 2 — the output for each first node (single-per-node via unique(node_id)).
  const { data: outputs } = await supabase
    .from("node_outputs")
    .select("node_id, kind, storage_path")
    .in("node_id", nodeIds);
  const outByNode = new Map<
    string,
    { kind: ThumbKind; storage_path: string | null }
  >();
  for (const o of (outputs ?? []) as Array<{
    node_id: string;
    kind: ThumbKind;
    storage_path: string | null;
  }>) {
    if (!outByNode.has(o.node_id)) outByNode.set(o.node_id, o);
  }

  // Resolve image thumbnails to signed URLs (batched over the page; ≤ PAGE_SIZE).
  // Construct the storage client lazily — only when a page actually carries an image output —
  // so a text-only feed never touches storage.
  const hasImage = [...outByNode.values()].some(
    (o) => o.kind === "image" && o.storage_path,
  );
  const storage = hasImage ? createSupabaseStorage(supabase) : null;
  await Promise.all(
    [...firstNodeByWorkflow.entries()].map(async ([wfId, nodeId]) => {
      const out = outByNode.get(nodeId);
      if (!out) {
        result.set(wfId, { kind: null, url: null });
        return;
      }
      let url: string | null = null;
      if (storage && out.kind === "image" && out.storage_path) {
        try {
          url = await storage.signedUrl(deriveThumbPath(out.storage_path));
        } catch {
          url = null;
        }
      }
      result.set(wfId, { kind: out.kind, url });
    }),
  );
  return result;
}

/** Hot blend (Story 7.1): recency-decay exponent — HN-gravity convention; tunable. */
const HOT_GRAVITY = 1.5;
/** Hot blend candidate cap: the most-recent N published rows are ranked in-service. At v1 a
 *  profession's published count ≪ this, so the blend ranks the full set; the cap bounds scale. */
const HOT_BLEND_CAP = 250;

/**
 * Rank rows by a recency-weighted engagement blend (Story 7.1 / AC1 "Hot"): an HN-gravity score
 * `(fork_count + 0.5*tried_count) / (ageHours + 2)^HOT_GRAVITY`, highest first, with a unique `id`
 * desc tiebreak (the same deterministic order the column sorts use). A row with no `published_at`
 * sorts last. Pure + exported for unit testing (`asOf` = the reference time in ms).
 */
export function rankHotBlend(
  rows: PublishedCardRow[],
  asOf: number,
): PublishedCardRow[] {
  const scored = rows.map((r) => {
    const ageHours = r.published_at
      ? Math.max(0, (asOf - Date.parse(r.published_at)) / 3_600_000)
      : null;
    const score =
      ageHours === null
        ? -1
        : (r.fork_count + 0.5 * r.tried_count) / (ageHours + 2) ** HOT_GRAVITY;
    return { r, score };
  });
  scored.sort((a, b) => {
    const diff = b.score - a.score;
    if (diff !== 0) return diff;
    return a.r.id < b.r.id ? 1 : a.r.id > b.r.id ? -1 : 0; // `id` desc tiebreak
  });
  return scored.map((s) => s.r);
}

/**
 * The Hot-blend feed path (Story 7.1) — community-scoped. Fetches a bounded window of the most-
 * recent published candidates (the recency decay crushes older rows, so capping by recency rarely
 * drops a true top-scorer), ranks them with `rankHotBlend`, slices the page, then enriches with
 * thumbnails. Reuses the same filter chain + `CARD_SELECT`/`toCardData`/`resolveThumbs` as the
 * column-sort path; `total` stays the exact published count for "Showing X of Y".
 */
async function listHotBlendFeed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    professionId: string | null;
    tagWorkflowIds: string[] | null;
    limit: number;
    offset: number;
    asOf?: string;
  },
): Promise<{ items: WorkflowCardData[]; total: number }> {
  const { professionId, tagWorkflowIds, limit, offset, asOf } = opts;
  let query = supabase
    .from("workflows")
    .select(CARD_SELECT, { count: "exact" })
    .eq("status", "published");
  if (professionId) query = query.eq("profession_id", professionId);
  if (tagWorkflowIds) query = query.in("id", tagWorkflowIds);
  const { data, count } = await query
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .range(0, HOT_BLEND_CAP - 1);
  const total = count ?? 0;
  if (total > HOT_BLEND_CAP) {
    console.warn(
      `listPublishedWorkflows: Hot blend ranked only the ${HOT_BLEND_CAP} most-recent of ${total} candidates`,
    );
  }
  // Report a total the feed can actually page to: the blend only ranks the most-recent CAP
  // candidates, so reporting the full published count would let `ExploreFeed`'s
  // `items.length >= total` never trip past the cap → "Load more" strands (slicing past the
  // ranked window appends nothing). Capping makes the Hot feed honestly reach "all caught up".
  const reachableTotal = Math.min(total, HOT_BLEND_CAP);
  const asOfMs = asOf ? Date.parse(asOf) : Date.now();
  const ranked = rankHotBlend((data ?? []) as PublishedCardRow[], asOfMs).slice(
    offset,
    offset + limit,
  );
  if (ranked.length === 0) return { items: [], total: reachableTotal };
  const thumbs = await resolveThumbs(
    supabase,
    ranked.map((r) => r.id),
  );
  const items = ranked.map((r) =>
    toCardData(r, thumbs.get(r.id) ?? { kind: null, url: null }),
  );
  return { items, total: reachableTotal };
}

/**
 * A page of PUBLISHED workflows for the Explore feed (Story 6.1 / FR3). Public —
 * NO `auth.getUser` gate; RLS (`status='published' OR author`) is the boundary, so a
 * signed-out visitor reads the same published rows (mirrors `getPublishedWorkflow`).
 * Offset pagination with an exact `total` ("Showing X of Y"). `sort`: `trending` = Hot
 * (most-forked, recency tiebreak; or a recency-weighted engagement blend when `hotBlend`),
 * `new` = recency, `top` = all-time worked-%/forks. `profession` is a slug; an unknown
 * slug falls back to no filter (never 404). Not cached (varying object args defeat it).
 */
export async function listPublishedWorkflows(opts: {
  profession?: string | null;
  tag?: string | null;
  sort?: WorkflowSort;
  limit?: number;
  offset?: number;
  /** Community-only (Story 7.1): rank `trending` as a recency-weighted engagement blend instead
   *  of the column sort. /explore never sets this, so its `trending` is byte-for-byte unchanged. */
  hotBlend?: boolean;
  /** Reference time (ISO) for the Hot blend's recency decay — captured once at SSR and threaded
   *  through Load more so pagination stays deterministic across pages. Defaults to now. */
  asOf?: string;
}): Promise<{ items: WorkflowCardData[]; total: number }> {
  const {
    profession = null,
    tag = null,
    sort = "trending",
    limit = PAGE_SIZE,
    offset = 0,
    hotBlend = false,
    asOf,
  } = opts;
  const supabase = await createClient();

  // Resolve the profession slug → id (filter by id; unknown slug → no filter).
  let professionId: string | null = null;
  if (profession) {
    const { data: prof } = await supabase
      .from("professions")
      .select("id")
      .eq("slug", profession)
      .maybeSingle();
    professionId = (prof as { id: string } | null)?.id ?? null;
  }

  // Resolve the tag slug → the published-workflow ids carrying it. Unlike an
  // unknown profession (→ no filter), an unknown tag (or a tag with zero
  // workflows) is a real "no matches" → an empty feed, not the unfiltered one.
  let tagWorkflowIds: string[] | null = null;
  if (tag) {
    tagWorkflowIds = await workflowIdsForTag(supabase, tag);
    if (tagWorkflowIds.length === 0) return { items: [], total: 0 };
  }

  // Community Hot blend (Story 7.1): a recency-weighted engagement blend can't be expressed as
  // PostgREST column ordering, so rank it in-service over a bounded candidate window. Only a
  // community feed opts in (`hotBlend`); /explore never does, so its `trending` stays the
  // deterministic column sort below. The at-scale SQL-side blend is a documented post-launch path.
  if (hotBlend && sort === "trending") {
    return listHotBlendFeed(supabase, {
      professionId,
      tagWorkflowIds,
      limit,
      offset,
      asOf,
    });
  }

  let query = supabase
    .from("workflows")
    .select(CARD_SELECT, { count: "exact" })
    .eq("status", "published");
  if (professionId) query = query.eq("profession_id", professionId);
  // `.in()` chains BEFORE the sort/range terminal (the mock-terminal rule).
  if (tagWorkflowIds) query = query.in("id", tagWorkflowIds);
  // A unique `id` tiebreak terminates every sort so offset pagination is deterministic across
  // the SSR page + the Load-more page (colliding sort keys would otherwise let a card duplicate
  // or get skipped at the page boundary). Top = all-time worked-%/forks with forks PRIMARY, so
  // the Epic-4 `worked_score` count/ratio blocker stays a secondary key only (see explore.ts).
  query =
    sort === "new"
      ? query
          .order("published_at", { ascending: false })
          .order("id", { ascending: false })
      : sort === "top"
        ? query
            .order("fork_count", { ascending: false })
            .order("worked_score", { ascending: false })
            .order("id", { ascending: false })
        : query
            .order("fork_count", { ascending: false })
            .order("published_at", { ascending: false })
            .order("id", { ascending: false });

  // `.range()` is the awaitable terminal — every filter/order is chained BEFORE it.
  const { data, count } = await query.range(offset, offset + limit - 1);
  const rows = (data ?? []) as PublishedCardRow[];
  const total = count ?? 0;
  if (rows.length === 0) return { items: [], total };

  const thumbs = await resolveThumbs(
    supabase,
    rows.map((r) => r.id),
  );
  const items = rows.map((r) =>
    toCardData(r, thumbs.get(r.id) ?? { kind: null, url: null }),
  );
  return { items, total };
}

/**
 * The newest published workflows for the "New this week" rail (Story 6.1) — recency-sorted,
 * no profession filter. Reuses `listPublishedWorkflows({ sort: "new" })`.
 */
export async function listNewThisWeek(limit = 10): Promise<WorkflowCardData[]> {
  const { items } = await listPublishedWorkflows({
    sort: "new",
    limit,
    offset: 0,
  });
  return items;
}

/**
 * Replace a workflow's tag set (Story 6.2): delete the existing join rows, insert the
 * selected ones. Author-scoped by the `workflow_tags` RLS (insert/delete check the
 * workflow's author). Best-effort — a tag-write failure leaves the workflow saved (a
 * re-save fixes it); the workflow row is the primary write, tags are secondary metadata.
 */
async function replaceWorkflowTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workflowId: string,
  tagIds: string[],
): Promise<void> {
  await supabase.from("workflow_tags").delete().eq("workflow_id", workflowId);
  const unique = [...new Set(tagIds)];
  if (unique.length === 0) return;
  await supabase
    .from("workflow_tags")
    .insert(unique.map((tag_id) => ({ workflow_id: workflowId, tag_id })));
}

/** Create a draft owned by the caller (status defaults to 'draft'). */
export async function createDraft(input: DraftInput): Promise<WorkflowResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("workflows")
    .insert({
      author_id: user.id,
      profession_id: input.profession_id,
      title: input.title,
      summary: input.summary,
    })
    .select("id")
    .single();
  if (error) {
    // 23503 = foreign_key_violation (profession_id isn't a real profession).
    if (error.code === "23503")
      return { ok: false, error: "invalid_profession" };
    return { ok: false, error: "db_error" };
  }
  await replaceWorkflowTags(supabase, data.id, input.tags);
  return { ok: true, id: data.id };
}

/** Update a draft the caller owns (title/summary/profession only — never status). */
export async function updateDraft(
  id: string,
  input: DraftInput,
): Promise<WorkflowResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const patch: TablesUpdate<"workflows"> = {
    title: input.title,
    summary: input.summary,
    profession_id: input.profession_id,
  };
  // `.select()` so a zero-row UPDATE (someone else's / nonexistent draft) is a
  // typed not_found, not a false success (the 1.4 updateProfile bug class).
  const { data, error } = await supabase
    .from("workflows")
    .update(patch)
    .eq("id", id)
    .eq("author_id", user.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23503")
      return { ok: false, error: "invalid_profession" };
    return { ok: false, error: "db_error" };
  }
  if (!data) return { ok: false, error: "not_found" };
  await replaceWorkflowTags(supabase, data.id, input.tags);
  return { ok: true, id: data.id };
}

/**
 * Rename a draft (title only) — the editor's inline-title autosave (no redirect).
 * Owner+draft scoped; `.select()` makes a zero-row update a typed not_found.
 */
export async function renameDraft(
  id: string,
  title: string,
): Promise<WorkflowResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("workflows")
    .update({ title })
    .eq("id", id)
    .eq("author_id", user.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, id: data.id };
}

/**
 * Update a draft's metadata EXCEPT the title (summary/profession/tags) — the editor's
 * "Workflow details" disclosure. The title has its own inline autosave (`renameDraft`),
 * so this never touches it (no overwrite race between the two). Owner+draft scoped.
 */
export async function updateDraftDetails(
  id: string,
  input: { summary: string | null; profession_id: string; tags: string[] },
): Promise<WorkflowResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const patch: TablesUpdate<"workflows"> = {
    summary: input.summary,
    profession_id: input.profession_id,
  };
  const { data, error } = await supabase
    .from("workflows")
    .update(patch)
    .eq("id", id)
    .eq("author_id", user.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23503")
      return { ok: false, error: "invalid_profession" };
    return { ok: false, error: "db_error" };
  }
  if (!data) return { ok: false, error: "not_found" };
  await replaceWorkflowTags(supabase, data.id, input.tags);
  return { ok: true, id: data.id };
}

/**
 * Publish a draft (FR9/FR10 MOAT gate). Delegates to the `publish_workflow`
 * SECURITY DEFINER RPC — the ONLY path that may flip status→'published', since
 * the 2.1 column lock keeps status/published_at revoked from `authenticated` for
 * direct writes. The RPC re-asserts owner+draft itself and returns a jsonb
 * `{ ok, reason, missing }`; we map it to the typed PublishResult.
 */
export async function publishWorkflow(
  workflowId: string,
): Promise<PublishResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase.rpc("publish_workflow", {
    p_workflow_id: workflowId,
  });
  if (error) {
    // 42501 = the RPC's owner/draft re-assertion failed (not your draft, or
    // already published). Map to not_found, the codebase convention.
    if (error.code === "42501") return { ok: false, error: "not_found" };
    return { ok: false, error: "db_error" };
  }

  // The RPC always returns a non-null jsonb object; guard the null case anyway so a
  // malformed/empty response degrades to db_error instead of a TypeError.
  if (!data) return { ok: false, error: "db_error" };
  // The RPC is the sole producer of this shape; a cast (not a parse) matches the
  // 2.3 Args cast convention in workflow-nodes.ts.
  const result = data as {
    ok: boolean;
    reason: "no_nodes" | "missing_outputs" | null;
    missing: PublishMissingNode[];
  };
  if (result.ok) return { ok: true, id: workflowId };
  if (result.reason === "no_nodes") return { ok: false, error: "no_nodes" };
  if (result.reason === "missing_outputs")
    return { ok: false, error: "missing_outputs", missing: result.missing };
  return { ok: false, error: "db_error" };
}

/**
 * Fork a PUBLISHED workflow into a new editable draft owned by the caller (FR15 / UX-DR7).
 * Delegates to the `fork_workflow` SECURITY DEFINER RPC — the ONLY path that may set
 * `parent_id` (client-locked) and copy nodes/edges/outputs atomically; the maintain-lineage
 * trigger then writes the closure rows + increments the source's `fork_count`. Returns the new
 * draft's id (the caller navigates into its editor). Binary outputs are zero-copy references to
 * the source's published storage objects (no duplication).
 */
export async function forkWorkflow(sourceId: string): Promise<ForkResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase.rpc("fork_workflow", {
    p_source_id: sourceId,
  });
  if (error) {
    // 42501 = the RPC's not-authenticated raise; P0001 = 'invalid fork source'
    // (a draft / nonexistent source — one generic error, no existence oracle).
    if (error.code === "42501")
      return { ok: false, error: "not_authenticated" };
    if (error.code === "P0001") return { ok: false, error: "invalid_source" };
    return { ok: false, error: "db_error" };
  }
  if (!data) return { ok: false, error: "db_error" };
  return { ok: true, forkId: data };
}

/** Delete a draft the caller owns. Zero-row delete → not_found. */
export async function deleteDraft(id: string): Promise<WorkflowResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("workflows")
    .delete()
    .eq("id", id)
    .eq("author_id", user.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, id: data.id };
}
