import "server-only";
import { PAGE_SIZE } from "@/lib/explore";
import type { SearchResult, SearchResultCard, SearchSort } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { embedText } from "./embeddings/embedder";
import {
  CARD_SELECT,
  type PublishedCardRow,
  resolveThumbs,
  toCardData,
} from "./workflows";

/**
 * Semantic search (Story 10.2 / FR2). `searchWorkflows` embeds the query (reusing the Story 10.1
 * `embedText` — the SAME model + L2-normalize, so query and stored vectors share one space), ranks
 * PUBLISHED workflows by cosine similarity via the `match_workflows` RPC over the HNSW index (called
 * with the SERVICE-ROLE admin client — the only reader of the client-locked `workflow_embeddings`),
 * then enriches the matched ids into feed cards with the RLS-bound server client (published rows are
 * public). If the embedder (or the RPC) is unavailable, it TRANSPARENTLY falls back to Postgres FTS
 * (`keywordSearch`, Story 10.3 absorbed) and flags `degraded` — search NEVER throws a 500 (FR2
 * "done-when"). The query embedding is cached per process so popular queries skip the embed call
 * (NFR1 p95 / NFR2 cost). [Source: architecture.md DR-4; epics.md#Story-10.2; Story 10.1 embedder + admin]
 */

/** Bounded candidate window — fetch the top-N by similarity, then sort + paginate in-service (the 7.1
 *  pattern). The reported `total` is capped at this so "Load more" can't strand past the window. */
const MATCH_CAP = 60;

/** Similarity floor for "close matches" (AC2). 0 in v1 so the stub-embedding dev/CI corpus returns
 *  rows; raise once real embeddings populate (real cosine similarities are well above 0 for matches). */
const SIMILARITY_THRESHOLD = 0;

/**
 * Per-process query→embedding cache (NFR1/NFR2 — a popular query embeds once per instance, not per
 * request). Failures are evicted so a transient embedder error can retry. A cross-instance cache
 * (`unstable_cache` / a `search_query_cache` table) is the documented scale path. Bounded so it can't
 * grow without limit.
 */
const queryEmbeddingCache = new Map<string, Promise<number[]>>();
const QUERY_CACHE_CAP = 1000;

function embedQuery(query: string): Promise<number[]> {
  const key = `${process.env.EMBED_MODEL ?? "gemini-embedding-001"}:${query}`;
  const cached = queryEmbeddingCache.get(key);
  if (cached) return cached;
  if (queryEmbeddingCache.size >= QUERY_CACHE_CAP) queryEmbeddingCache.clear();
  const pending = embedText(query).catch((err) => {
    queryEmbeddingCache.delete(key); // don't cache a failure — allow the next request to retry
    throw err;
  });
  queryEmbeddingCache.set(key, pending);
  return pending;
}

/** Test-only: reset the query-embedding cache between cases. */
export function __resetQueryEmbeddingCache(): void {
  queryEmbeddingCache.clear();
}

type MatchRow = {
  workflow_id: string;
  similarity: number;
  total_count: number;
};

export async function searchWorkflows(opts: {
  query: string;
  professionId?: string | null;
  tagIds?: string[] | null;
  sort?: SearchSort;
  limit?: number;
  offset?: number;
}): Promise<SearchResult> {
  const {
    query,
    professionId = null,
    tagIds = null,
    sort = "best",
    limit = PAGE_SIZE,
    offset = 0,
  } = opts;
  const q = query.trim();
  if (!q) return { items: [], total: 0, degraded: false };

  // 1) Embed the query (cached). Embedder unavailable → transparent FTS fallback (never a 500).
  let embedding: number[];
  try {
    embedding = await embedQuery(q);
  } catch (err) {
    console.warn("[search] embedder failed → keyword fallback", err);
    return keywordSearch({ query: q, professionId, tagIds, limit, offset });
  }

  // 2) Rank via the service-role match RPC (the only reader of the locked embeddings).
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("match_workflows", {
    query_embedding: `[${embedding.join(",")}]`,
    match_limit: MATCH_CAP,
    match_offset: 0,
    p_profession_id: professionId ?? undefined,
    p_tag_ids: tagIds ?? undefined,
    similarity_threshold: SIMILARITY_THRESHOLD,
  });
  if (error) {
    console.warn("[search] match_workflows failed → keyword fallback", error);
    return keywordSearch({ query: q, professionId, tagIds, limit, offset });
  }
  const matches = (data ?? []) as MatchRow[];
  if (matches.length === 0) return { items: [], total: 0, degraded: false };

  const rawTotal = Number(matches[0].total_count ?? matches.length);
  if (rawTotal > MATCH_CAP) {
    console.warn(
      `[search] matched ${rawTotal} > cap ${MATCH_CAP}; older matches are not paged for this query.`,
    );
  }
  const total = Math.min(rawTotal, MATCH_CAP);

  // 3) Enrich the matched ids → cards (RLS-bound server client; published rows are public), preserving
  //    the RPC relevance order, then sort in-service over the bounded window + slice the page.
  const simById = new Map(matches.map((m) => [m.workflow_id, m.similarity]));
  const ordered = matches.map((m) => m.workflow_id);
  const cards = await enrichSearchCards(ordered, simById);
  const sorted = sortSearchCards(cards, sort);
  return {
    items: sorted.slice(offset, offset + limit),
    total,
    degraded: false,
  };
}

/**
 * Postgres FTS keyword fallback (Story 10.3, absorbed — Task 8). Runs RLS-bound (published rows are
 * public → NO admin client, NO RPC, NO advisor impact) over the generated `workflows.search_vector`
 * GIN index. Returns `degraded: true` so the page renders the "Semantic search is resting — showing
 * keyword matches." surface. Called from `searchWorkflows`'s embed/RPC catch, and reusable directly.
 */
export async function keywordSearch(opts: {
  query: string;
  professionId?: string | null;
  tagIds?: string[] | null;
  limit?: number;
  offset?: number;
}): Promise<SearchResult> {
  const {
    query,
    professionId = null,
    tagIds = null,
    limit = PAGE_SIZE,
    offset = 0,
  } = opts;
  const q = query.trim();
  if (!q) return { items: [], total: 0, degraded: true };
  const supabase = await createClient();

  // A tag filter resolves to the published-workflow ids carrying ANY of the tags (mirrors the RPC's
  // `= any(p_tag_ids)`); an unknown/empty tag set is a real "no matches", not the unfiltered feed.
  let tagWorkflowIds: string[] | null = null;
  if (tagIds && tagIds.length > 0) {
    const { data: wt } = await supabase
      .from("workflow_tags")
      .select("workflow_id")
      .in("tag_id", tagIds);
    tagWorkflowIds = [
      ...new Set(
        ((wt ?? []) as Array<{ workflow_id: string }>).map(
          (r) => r.workflow_id,
        ),
      ),
    ];
    if (tagWorkflowIds.length === 0)
      return { items: [], total: 0, degraded: true };
  }

  let qb = supabase
    .from("workflows")
    .select(CARD_SELECT, { count: "exact" })
    .eq("status", "published")
    .textSearch("search_vector", q, { type: "websearch", config: "english" });
  if (professionId) qb = qb.eq("profession_id", professionId);
  if (tagWorkflowIds) qb = qb.in("id", tagWorkflowIds);
  // No computed `ts_rank` column to ORDER by without an RPC; v1 ranks by engagement (fork_count) with
  // a unique `id` tiebreak for deterministic offset pagination (the 6.1 lesson). The GIN match already
  // scopes the set to keyword-relevant rows.
  const { data, count } = await qb
    .order("fork_count", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  const rows = (data ?? []) as PublishedCardRow[];
  const total = count ?? 0;
  if (rows.length === 0) return { items: [], total, degraded: true };
  const thumbs = await resolveThumbs(
    supabase,
    rows.map((r) => r.id),
  );
  const items: SearchResultCard[] = rows.map((r) => ({
    ...toCardData(r, thumbs.get(r.id) ?? { kind: null, url: null }),
    matchPct: null, // keyword matches carry no similarity score
  }));
  return { items, total, degraded: true };
}

/**
 * Fetch the matched ids as feed cards (CARD_SELECT + thumbnails) via the RLS-bound server client,
 * RE-SORTED into the RPC's relevance order (PostgREST does not preserve `.in()` order — the 6.1/5.2
 * lesson). Attaches `matchPct` (cosine similarity → a clamped 0–100%). A matched id that isn't
 * readable (shouldn't happen — all are published) is dropped, not rendered broken.
 */
async function enrichSearchCards(
  orderedIds: string[],
  simById: Map<string, number>,
): Promise<SearchResultCard[]> {
  if (orderedIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("workflows")
    .select(CARD_SELECT)
    .eq("status", "published")
    .in("id", orderedIds);
  const rows = (data ?? []) as PublishedCardRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const thumbs = await resolveThumbs(
    supabase,
    rows.map((r) => r.id),
  );
  const cards: SearchResultCard[] = [];
  for (const id of orderedIds) {
    const row = byId.get(id);
    if (!row) continue;
    const sim = simById.get(id);
    cards.push({
      ...toCardData(row, thumbs.get(id) ?? { kind: null, url: null }),
      matchPct:
        sim != null ? Math.max(0, Math.min(100, Math.round(sim * 100))) : null,
    });
  }
  return cards;
}

/** In-service sort over the bounded match window. "best" keeps the RPC relevance order. */
function sortSearchCards(
  cards: SearchResultCard[],
  sort: SearchSort,
): SearchResultCard[] {
  if (sort === "best") return cards;
  const copy = [...cards];
  if (sort === "forked") {
    copy.sort((a, b) => b.forkCount - a.forkCount || a.id.localeCompare(b.id));
  } else {
    copy.sort(
      (a, b) =>
        (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") ||
        a.id.localeCompare(b.id),
    );
  }
  return copy;
}
