import { beforeEach, describe, expect, it, vi } from "vitest";

const singleMock = vi.fn();
const maybeSingleMock = vi.fn();
const orderMock = vi.fn();
const inMock = vi.fn();
const rangeMock = vi.fn();
const getUserMock = vi.fn();
const rpcMock = vi.fn();

// One self-chaining builder covering every query the service uses; the chain
// terminals (.single / .maybeSingle / .order) are the controllable mocks.
vi.mock("@/lib/supabase/server", () => ({
  // Built inside createClient (runtime) so the hoisted factory doesn't touch the
  // mock consts before they're initialized.
  createClient: vi.fn(async () => {
    const b = {
      insert: () => b,
      select: () => b,
      update: () => b,
      delete: () => b,
      eq: () => b,
      not: () => b,
      in: inMock,
      // `order` is a terminal when a test configures it (returns the resolved promise), but
      // chainable when not (returns the builder) — so `.order().order().range()` works without
      // breaking the existing queries that `await` a single `.order()`.
      order: (...args: unknown[]) => {
        const r = orderMock(...args);
        return r === undefined ? b : r;
      },
      range: rangeMock,
      single: singleMock,
      maybeSingle: maybeSingleMock,
    };
    return { from: () => b, rpc: rpcMock, auth: { getUser: getUserMock } };
  }),
}));

import {
  createDraft,
  deleteDraft,
  forkWorkflow,
  getForkParentHandle,
  getMyDraft,
  getPublishedWorkflow,
  listMyDrafts,
  listMyForks,
  listNewThisWeek,
  listPublishedWorkflows,
  publishWorkflow,
  rankHotBlend,
  updateDraft,
} from "./workflows";

const USER = { data: { user: { id: "u1" } } };
const NO_USER = { data: { user: null } };
const input = { title: "X", summary: null, profession_id: "p1", tags: [] };

beforeEach(() => vi.clearAllMocks());

describe("listMyDrafts", () => {
  it("returns [] when unauthenticated (no query)", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await listMyDrafts()).toEqual([]);
    expect(orderMock).not.toHaveBeenCalled();
  });

  it("returns the caller's drafts", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    orderMock.mockResolvedValueOnce({
      data: [{ id: "w1", title: "X" }],
      error: null,
    });
    expect(await listMyDrafts()).toHaveLength(1);
  });
});

describe("listMyForks", () => {
  it("returns [] when unauthenticated (no query)", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await listMyForks()).toEqual([]);
    expect(orderMock).not.toHaveBeenCalled();
  });

  it("enriches each fork with its parent's title + author handle (batch query)", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    orderMock.mockResolvedValueOnce({
      data: [{ id: "f1", title: "My fork", status: "draft", parent_id: "p1" }],
      error: null,
    });
    inMock.mockResolvedValueOnce({
      data: [
        {
          id: "p1",
          title: "Source",
          status: "published",
          author: { handle: "nok" },
        },
      ],
      error: null,
    });
    const forks = await listMyForks();
    expect(forks).toHaveLength(1);
    expect(forks[0].parent?.id).toBe("p1");
    expect(forks[0].parent?.author?.handle).toBe("nok");
  });

  it("maps an unreadable parent to null (graceful — the published-only batch hides it)", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    orderMock.mockResolvedValueOnce({
      data: [{ id: "f1", title: "My fork", status: "draft", parent_id: "p1" }],
      error: null,
    });
    // The parent batch (published-only) returns no matching row → parentMap miss → parent: null.
    inMock.mockResolvedValueOnce({ data: [], error: null });
    const forks = await listMyForks();
    expect(forks).toHaveLength(1);
    expect(forks[0].parent).toBeNull();
  });
});

describe("createDraft", () => {
  it("requires authentication", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await createDraft(input)).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("returns the new id on success", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    singleMock.mockResolvedValueOnce({ data: { id: "w9" }, error: null });
    expect(await createDraft(input)).toEqual({ ok: true, id: "w9" });
  });

  it("maps a bad profession FK to invalid_profession", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    singleMock.mockResolvedValueOnce({ data: null, error: { code: "23503" } });
    expect(await createDraft(input)).toEqual({
      ok: false,
      error: "invalid_profession",
    });
  });
});

describe("updateDraft", () => {
  it("returns not_found on a zero-row update", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await updateDraft("w1", input)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("succeeds when a row is updated", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "w1" }, error: null });
    expect(await updateDraft("w1", input)).toEqual({ ok: true, id: "w1" });
  });
});

describe("deleteDraft", () => {
  it("returns not_found when nothing was deleted", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await deleteDraft("w1")).toEqual({ ok: false, error: "not_found" });
  });

  it("succeeds when a row is deleted", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "w1" }, error: null });
    expect(await deleteDraft("w1")).toEqual({ ok: true, id: "w1" });
  });
});

describe("getMyDraft", () => {
  it("returns null when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await getMyDraft("w1")).toBeNull();
  });
});

describe("getPublishedWorkflow", () => {
  it("returns the published workflow without requiring auth", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: "w1", status: "published", author: { handle: "x" } },
      error: null,
    });
    const wf = await getPublishedWorkflow("w1");
    expect(wf?.id).toBe("w1");
    // Public viewer: must NOT gate on getUser (anon visitors).
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("returns null when no published row matches (draft/missing → RLS hides it)", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await getPublishedWorkflow("w1")).toBeNull();
  });
});

describe("listPublishedWorkflows", () => {
  const cardRow = {
    id: "w1",
    title: "Revenue dashboard",
    fork_count: 198,
    worked_score: 0.91,
    tried_count: 20,
    profession: { slug: "data-analysts", name: "Data Analysts" },
    author: { handle: "priya", display_name: "Priya", avatar_url: null },
  };

  it("short-circuits an empty page (no thumbnail enrichment, no auth gate)", async () => {
    rangeMock.mockResolvedValueOnce({ data: [], count: 0, error: null });
    expect(await listPublishedWorkflows({})).toEqual({ items: [], total: 0 });
    // Empty page → resolveThumbs never runs (no `.in()` enrichment queries).
    expect(inMock).not.toHaveBeenCalled();
    // Public feed: RLS-only, never gates on the session.
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("returns an empty feed for an unknown tag (real 'no matches', never the main query)", async () => {
    // workflowIdsForTag resolves the tag slug → id; an unknown tag → maybeSingle null → [].
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await listPublishedWorkflows({ tag: "bogus" })).toEqual({
      items: [],
      total: 0,
    });
    // The empty tag set short-circuits BEFORE the published-workflows query runs.
    expect(rangeMock).not.toHaveBeenCalled();
  });

  it("returns enriched cards with the exact total (2-step .in() thumbnail enrich)", async () => {
    rangeMock.mockResolvedValueOnce({
      data: [cardRow],
      count: 248,
      error: null,
    });
    inMock.mockResolvedValueOnce({
      data: [{ id: "n1", workflow_id: "w1" }],
      error: null,
    }); // first nodes
    inMock.mockResolvedValueOnce({
      data: [{ node_id: "n1", kind: "text", storage_path: null }],
      error: null,
    }); // outputs
    const { items, total } = await listPublishedWorkflows({});
    expect(total).toBe(248);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "w1",
      title: "Revenue dashboard",
      authorHandle: "priya",
      professionName: "Data Analysts",
      forkCount: 198,
      workedScore: 0.91,
      triedCount: 20,
      thumb: { kind: "text", url: null },
    });
  });

  it("resolves a profession slug → id before filtering", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "p1" }, error: null });
    rangeMock.mockResolvedValueOnce({ data: [cardRow], count: 1, error: null });
    inMock.mockResolvedValueOnce({
      data: [{ id: "n1", workflow_id: "w1" }],
      error: null,
    });
    inMock.mockResolvedValueOnce({
      data: [{ node_id: "n1", kind: "text", storage_path: null }],
      error: null,
    });
    const { items } = await listPublishedWorkflows({
      profession: "data-analysts",
    });
    expect(maybeSingleMock).toHaveBeenCalled(); // the slug→id lookup ran
    expect(items).toHaveLength(1);
  });

  it("falls back to a wash (kind:null) when a workflow has no readable output", async () => {
    rangeMock.mockResolvedValueOnce({ data: [cardRow], count: 1, error: null });
    inMock.mockResolvedValueOnce({
      data: [{ id: "n1", workflow_id: "w1" }],
      error: null,
    });
    inMock.mockResolvedValueOnce({ data: [], error: null }); // no outputs
    const { items } = await listPublishedWorkflows({});
    expect(items[0].thumb).toEqual({ kind: null, url: null });
  });

  it("sorts `top` by worked-%/forks — fork_count, then worked_score, then id (Story 7.1)", async () => {
    rangeMock.mockResolvedValueOnce({ data: [], count: 0, error: null });
    await listPublishedWorkflows({ sort: "top" });
    expect(orderMock.mock.calls.map((c) => c[0])).toEqual([
      "fork_count",
      "worked_score",
      "id",
    ]);
  });

  it("sorts `new` by recency — published_at, then id", async () => {
    rangeMock.mockResolvedValueOnce({ data: [], count: 0, error: null });
    await listPublishedWorkflows({ sort: "new" });
    expect(orderMock.mock.calls.map((c) => c[0])).toEqual([
      "published_at",
      "id",
    ]);
  });

  it("sorts column `trending` — fork_count, then published_at, then id", async () => {
    rangeMock.mockResolvedValueOnce({ data: [], count: 0, error: null });
    await listPublishedWorkflows({ sort: "trending" });
    expect(orderMock.mock.calls.map((c) => c[0])).toEqual([
      "fork_count",
      "published_at",
      "id",
    ]);
  });

  it("Hot blend (hotBlend) fetches a recency-bounded window, not the column trending ladder (Story 7.1)", async () => {
    rangeMock.mockResolvedValueOnce({ data: [], count: 0, error: null });
    await listPublishedWorkflows({ sort: "trending", hotBlend: true });
    // The blend orders the candidate fetch by recency (published_at, id) then ranks in JS —
    // it must NOT lead with fork_count like the column trending sort.
    expect(orderMock.mock.calls.map((c) => c[0])).toEqual([
      "published_at",
      "id",
    ]);
  });

  it("caps the Hot-blend total at the candidate window so Load more can't strand past the cap (Story 7.1)", async () => {
    // 300 published but the blend only ranks/slices the most-recent 250 → report a reachable total.
    rangeMock.mockResolvedValueOnce({
      data: [cardRow],
      count: 300,
      error: null,
    });
    inMock.mockResolvedValueOnce({
      data: [{ id: "n1", workflow_id: "w1" }],
      error: null,
    });
    inMock.mockResolvedValueOnce({
      data: [{ node_id: "n1", kind: "text", storage_path: null }],
      error: null,
    });
    const { total } = await listPublishedWorkflows({
      sort: "trending",
      hotBlend: true,
    });
    expect(total).toBe(250); // = HOT_BLEND_CAP
  });
});

describe("rankHotBlend", () => {
  const row = (
    id: string,
    fork_count: number,
    tried_count: number,
    published_at: string | null,
  ) => ({
    id,
    title: id,
    fork_count,
    worked_score: 0,
    tried_count,
    published_at,
    profession: null,
    author: null,
  });
  const NOW = Date.parse("2026-06-17T00:00:00.000Z");

  it("ranks a recent, forked workflow above an older, more-forked one (recency decay)", () => {
    const recent = row("recent", 30, 0, "2026-06-16T00:00:00.000Z");
    const old = row("old", 200, 0, "2026-04-01T00:00:00.000Z");
    expect(rankHotBlend([old, recent], NOW).map((r) => r.id)).toEqual([
      "recent",
      "old",
    ]);
  });

  it("breaks score ties by id descending (deterministic pagination)", () => {
    const a = row("a", 10, 0, "2026-06-16T00:00:00.000Z");
    const b = row("b", 10, 0, "2026-06-16T00:00:00.000Z");
    expect(rankHotBlend([a, b], NOW).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("sorts a row with no published_at last", () => {
    const dated = row("dated", 1, 0, "2026-06-10T00:00:00.000Z");
    const undated = row("undated", 999, 0, null);
    expect(rankHotBlend([undated, dated], NOW).map((r) => r.id)).toEqual([
      "dated",
      "undated",
    ]);
  });
});

describe("listNewThisWeek", () => {
  it("returns the newest published cards (delegates to listPublishedWorkflows)", async () => {
    rangeMock.mockResolvedValueOnce({
      data: [
        {
          id: "w2",
          title: "Newsletter from commits",
          fork_count: 3,
          worked_score: 0,
          tried_count: 0,
          profession: { slug: "content-writer", name: "Content Writer" },
          author: { handle: "noor", display_name: null, avatar_url: null },
        },
      ],
      count: 1,
      error: null,
    });
    inMock.mockResolvedValueOnce({
      data: [{ id: "n2", workflow_id: "w2" }],
      error: null,
    });
    inMock.mockResolvedValueOnce({
      data: [{ node_id: "n2", kind: "text", storage_path: null }],
      error: null,
    });
    const items = await listNewThisWeek(5);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("w2");
  });
});

describe("publishWorkflow", () => {
  it("requires authentication (no RPC call)", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await publishWorkflow("w1")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("publishes when every node is covered", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({
      data: { ok: true, reason: null, missing: [] },
      error: null,
    });
    expect(await publishWorkflow("w1")).toEqual({ ok: true, id: "w1" });
  });

  it("maps reason:missing_outputs to the typed error + node list", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({
      data: {
        ok: false,
        reason: "missing_outputs",
        missing: [{ id: "n2", idx: 1 }],
      },
      error: null,
    });
    expect(await publishWorkflow("w1")).toEqual({
      ok: false,
      error: "missing_outputs",
      missing: [{ id: "n2", idx: 1 }],
    });
  });

  it("maps reason:no_nodes to the no_nodes error", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({
      data: { ok: false, reason: "no_nodes", missing: [] },
      error: null,
    });
    expect(await publishWorkflow("w1")).toEqual({
      ok: false,
      error: "no_nodes",
    });
  });

  it("maps the RPC's 42501 (not owner / not draft) to not_found", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect(await publishWorkflow("w1")).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("maps any other RPC error to db_error", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
    expect(await publishWorkflow("w1")).toEqual({
      ok: false,
      error: "db_error",
    });
  });
});

describe("forkWorkflow", () => {
  it("requires authentication (no RPC call)", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await forkWorkflow("src-1")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns the new fork id on success", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({ data: "fork-123", error: null });
    expect(await forkWorkflow("src-1")).toEqual({
      ok: true,
      forkId: "fork-123",
    });
  });

  it("maps the RPC's 42501 raise to not_authenticated", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect(await forkWorkflow("src-1")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("maps P0001 (invalid fork source) to invalid_source", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "P0001" } });
    expect(await forkWorkflow("src-1")).toEqual({
      ok: false,
      error: "invalid_source",
    });
  });

  it("maps any other RPC error to db_error", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "55000" } });
    expect(await forkWorkflow("src-1")).toEqual({
      ok: false,
      error: "db_error",
    });
  });

  it("degrades a null RPC result to db_error", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await forkWorkflow("src-1")).toEqual({
      ok: false,
      error: "db_error",
    });
  });
});

describe("getForkParentHandle", () => {
  // Distinct parentIds per test — getForkParentHandle is cache()-wrapped, so a shared arg would
  // return the first test's memoized result.
  it("returns the parent author's handle", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { author: { handle: "nok" } },
      error: null,
    });
    expect(await getForkParentHandle("p-handle")).toBe("nok");
  });

  it("returns null when the parent is unresolved / unpublished", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await getForkParentHandle("p-null")).toBeNull();
  });

  it("returns null when the parent row has no author", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { author: null },
      error: null,
    });
    expect(await getForkParentHandle("p-noauthor")).toBeNull();
  });
});
