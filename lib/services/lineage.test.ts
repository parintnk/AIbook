import { beforeEach, describe, expect, it, vi } from "vitest";

const orderMock = vi.fn();
const inMock = vi.fn();

// A self-chaining builder; the chain terminals (.order for the closure query, .in for the batch
// enrichment) are the controllable mocks. The lineage reads are RLS-gated — no auth.getUser().
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const b = {
      select: () => b,
      eq: () => b,
      order: orderMock,
      in: inMock,
    };
    return { from: () => b };
  }),
}));

import { getAncestry, getLineageTree } from "./lineage";

/** A workflows-batch row as PostgREST returns it (snake_case + the to-one author embed). */
function wf(id: string, parent_id: string | null = null) {
  return {
    id,
    title: `WF ${id}`,
    summary: null,
    status: "published",
    fork_count: 0,
    worked_score: 0,
    tried_count: 0,
    parent_id,
    author: { handle: `u_${id}`, display_name: null, avatar_url: null },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("getLineageTree", () => {
  it("returns just the root (self-row) when there are no forks", async () => {
    orderMock.mockResolvedValueOnce({
      data: [{ descendant_id: "r", depth: 0 }],
      error: null,
    });
    inMock.mockResolvedValueOnce({ data: [wf("r")], error: null });
    const nodes = await getLineageTree("r");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("r");
    expect(nodes[0].depth).toBe(0);
  });

  it("enriches the subtree depth-asc (self-row + transitive descendants)", async () => {
    orderMock.mockResolvedValueOnce({
      data: [
        { descendant_id: "r", depth: 0 },
        { descendant_id: "c", depth: 1 },
        { descendant_id: "g", depth: 2 },
      ],
      error: null,
    });
    inMock.mockResolvedValueOnce({
      data: [wf("r"), wf("c", "r"), wf("g", "c")],
      error: null,
    });
    const nodes = await getLineageTree("r");
    expect(nodes.map((n) => n.id)).toEqual(["r", "c", "g"]);
    expect(nodes.map((n) => n.depth)).toEqual([0, 1, 2]);
    expect(nodes[1].parentId).toBe("r");
  });

  it("drops a closure row whose workflow the batch can't read (RLS hides it)", async () => {
    orderMock.mockResolvedValueOnce({
      data: [
        { descendant_id: "r", depth: 0 },
        { descendant_id: "hidden", depth: 1 },
      ],
      error: null,
    });
    // 'hidden' is a private draft fork by someone else → not returned by the batch.
    inMock.mockResolvedValueOnce({ data: [wf("r")], error: null });
    const nodes = await getLineageTree("r");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("r");
  });

  it("short-circuits (no batch query) when the closure returns nothing", async () => {
    orderMock.mockResolvedValueOnce({ data: [], error: null });
    expect(await getLineageTree("r")).toEqual([]);
    expect(inMock).not.toHaveBeenCalled();
  });
});

describe("getAncestry", () => {
  it("returns the breadcrumb chain root → … → here (depth-desc)", async () => {
    orderMock.mockResolvedValueOnce({
      data: [
        { ancestor_id: "origin", depth: 2 },
        { ancestor_id: "parent", depth: 1 },
        { ancestor_id: "self", depth: 0 },
      ],
      error: null,
    });
    inMock.mockResolvedValueOnce({
      data: [wf("origin"), wf("parent"), wf("self")],
      error: null,
    });
    const chain = await getAncestry("self");
    expect(chain.map((n) => n.id)).toEqual(["origin", "parent", "self"]);
  });
});
