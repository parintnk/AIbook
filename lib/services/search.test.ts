import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishedCardRow } from "./workflows";

// ── Mocks ──────────────────────────────────────────────────────────────────────
const embedText = vi.fn();
vi.mock("./embeddings/embedder", () => ({
  embedText: (...a: unknown[]) => embedText(...a),
}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

// Per-table fixtures for the RLS-bound server client (a thenable self-chaining builder — the 6.2
// pattern: filter methods return `b`, `then` resolves the configured result). A `.textSearch()` call
// flips the "workflows" result to the keyword fixture (that's the only path that calls it).
let enrichRows: PublishedCardRow[] = [];
let keywordResult: { data: PublishedCardRow[]; count: number } = {
  data: [],
  count: 0,
};
let tagRows: Array<{ workflow_id: string }> = [];

function makeBuilder(table: string) {
  let usedTextSearch = false;
  // biome-ignore lint/suspicious/noExplicitAny: a minimal chainable+thenable supabase query stub
  const b: any = {
    select: () => b,
    eq: () => b,
    in: () => b,
    order: () => b,
    range: () => b,
    textSearch: () => {
      usedTextSearch = true;
      return b;
    },
    // biome-ignore lint/suspicious/noThenProperty: an intentional thenable query-builder stub (the 6.2 pattern)
    then: (resolve: (v: unknown) => unknown) => {
      if (table === "workflow_tags") return resolve({ data: tagRows });
      if (usedTextSearch) return resolve(keywordResult);
      return resolve({ data: enrichRows });
    },
  };
  return b;
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (t: string) => makeBuilder(t) }),
}));

// Keep the REAL CARD_SELECT + toCardData (so the card shape is genuinely exercised); stub only the
// thumbnail resolver (its own DB queries are out of scope here).
vi.mock("./workflows", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, resolveThumbs: vi.fn(async () => new Map()) };
});

import {
  __resetQueryEmbeddingCache,
  keywordSearch,
  searchWorkflows,
} from "./search";

function row(
  id: string,
  fork = 0,
  publishedAt = "2026-01-01",
): PublishedCardRow {
  return {
    id,
    title: `WF ${id}`,
    fork_count: fork,
    worked_score: 0,
    tried_count: 0,
    published_at: publishedAt,
    profession: { slug: "p", name: "P" },
    author: { handle: "h", display_name: "H", avatar_url: null },
  };
}
const vec = Array.from({ length: 1536 }, () => 0.1);

beforeEach(() => {
  __resetQueryEmbeddingCache();
  embedText.mockReset();
  rpc.mockReset();
  embedText.mockResolvedValue(vec);
  enrichRows = [];
  keywordResult = { data: [], count: 0 };
  tagRows = [];
});

describe("searchWorkflows (semantic)", () => {
  it("ranks in the RPC relevance order with matchPct, regardless of .in() row order", async () => {
    rpc.mockResolvedValue({
      data: [
        { workflow_id: "w1", similarity: 0.9, total_count: 3 },
        { workflow_id: "w2", similarity: 0.8, total_count: 3 },
        { workflow_id: "w3", similarity: 0.7, total_count: 3 },
      ],
      error: null,
    });
    enrichRows = [row("w2"), row("w3"), row("w1")]; // PostgREST returns them unordered
    const res = await searchWorkflows({ query: "logo" });
    expect(res.degraded).toBe(false);
    expect(res.total).toBe(3);
    expect(res.items.map((i) => i.id)).toEqual(["w1", "w2", "w3"]);
    expect(res.items.map((i) => i.matchPct)).toEqual([90, 80, 70]);
  });

  it("returns the AC2 empty state (no degrade) when the RPC matches nothing", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const res = await searchWorkflows({ query: "nothing matches this" });
    expect(res).toEqual({ items: [], total: 0, degraded: false });
  });

  it("sorts the bounded window in-service (forked = fork_count desc)", async () => {
    rpc.mockResolvedValue({
      data: [
        { workflow_id: "w1", similarity: 0.9, total_count: 3 },
        { workflow_id: "w2", similarity: 0.8, total_count: 3 },
        { workflow_id: "w3", similarity: 0.7, total_count: 3 },
      ],
      error: null,
    });
    enrichRows = [row("w1", 5), row("w2", 9), row("w3", 1)];
    const res = await searchWorkflows({ query: "logo", sort: "forked" });
    expect(res.items.map((i) => i.id)).toEqual(["w2", "w1", "w3"]);
  });

  it("caches the query embedding (a repeat query does not re-embed)", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await searchWorkflows({ query: "repeat me" });
    await searchWorkflows({ query: "repeat me" });
    expect(embedText).toHaveBeenCalledTimes(1);
  });

  it("trims a blank query to the empty state without embedding", async () => {
    const res = await searchWorkflows({ query: "   " });
    expect(res).toEqual({ items: [], total: 0, degraded: false });
    expect(embedText).not.toHaveBeenCalled();
  });
});

describe("searchWorkflows → FTS fallback (degraded)", () => {
  it("falls back to keyword search when the embedder throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    embedText.mockRejectedValue(new Error("provider timeout"));
    keywordResult = { data: [row("k1"), row("k2")], count: 2 };
    const res = await searchWorkflows({ query: "logo" });
    expect(res.degraded).toBe(true);
    expect(res.items.map((i) => i.id)).toEqual(["k1", "k2"]);
    expect(res.items.every((i) => i.matchPct === null)).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("falls back to keyword search when the match RPC errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    keywordResult = { data: [row("k1")], count: 1 };
    const res = await searchWorkflows({ query: "logo" });
    expect(res.degraded).toBe(true);
    expect(res.items.map((i) => i.id)).toEqual(["k1"]);
    warn.mockRestore();
  });
});

describe("keywordSearch (direct)", () => {
  it("returns published keyword matches flagged degraded, with no matchPct", async () => {
    keywordResult = { data: [row("k1"), row("k2")], count: 2 };
    const res = await keywordSearch({ query: "brand kit" });
    expect(res.degraded).toBe(true);
    expect(res.total).toBe(2);
    expect(res.items.map((i) => i.matchPct)).toEqual([null, null]);
  });
});
