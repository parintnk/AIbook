import { beforeEach, describe, expect, it, vi } from "vitest";

const eqMock = vi.fn();
const inMock = vi.fn();
const limitMock = vi.fn();
const getUserMock = vi.fn();

// Self-chaining builder. Terminals: `.in` (the workflows/thumbnail queries) + `.limit`
// (the candidate query). `.order` is chainable here (the candidate query chains two
// `.order()`s before `.limit()`). `.eq` records its args (to assert profession scoping)
// but stays chainable.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const b = {
      select: () => b,
      lte: () => b,
      eq: (...args: unknown[]) => {
        eqMock(...args);
        return b;
      },
      order: () => b,
      in: inMock,
      limit: limitMock,
    };
    return { from: () => b, auth: { getUser: getUserMock } };
  }),
}));

import { getWorkflowOfTheDay } from "./featured";

const candidate = {
  feature_date: "2026-06-17",
  profession_id: "gd",
  workflow_id: "w1",
};

const publishedRow = {
  id: "w1",
  title: "Brand kit from a one-paragraph brief",
  fork_count: 233,
  worked_score: 0.92,
  tried_count: 51,
  published_at: "2026-06-16T00:00:00Z",
  profession: { slug: "graphic-designer", name: "Graphic Designer" },
  author: {
    handle: "alexrivera",
    display_name: "Alex Rivera",
    avatar_url: null,
  },
  workflow_nodes: [{ count: 3 }],
};

beforeEach(() => vi.clearAllMocks());

describe("getWorkflowOfTheDay", () => {
  it("returns the most recent published feature mapped to WotdData (no auth gate)", async () => {
    limitMock.mockResolvedValueOnce({ data: [candidate], error: null }); // candidates
    inMock.mockResolvedValueOnce({ data: [publishedRow], error: null }); // published workflows
    inMock.mockResolvedValueOnce({
      data: [{ id: "n1", workflow_id: "w1" }],
      error: null,
    }); // resolveThumbs — first nodes
    inMock.mockResolvedValueOnce({
      data: [{ node_id: "n1", kind: "image", storage_path: null }],
      error: null,
    }); // resolveThumbs — outputs

    const wotd = await getWorkflowOfTheDay();
    expect(wotd).toMatchObject({
      id: "w1",
      title: "Brand kit from a one-paragraph brief",
      authorHandle: "alexrivera",
      professionName: "Graphic Designer",
      professionSlug: "graphic-designer",
      forkCount: 233,
      workedScore: 0.92,
      triedCount: 51,
      stepCount: 3,
      featureDate: "2026-06-17",
      thumb: { kind: "image", url: null },
    });
    // Public surface: never gates on the session.
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("returns null when nothing is curated", async () => {
    limitMock.mockResolvedValueOnce({ data: [], error: null });
    expect(await getWorkflowOfTheDay()).toBeNull();
    // No candidates → never queries workflows.
    expect(inMock).not.toHaveBeenCalled();
  });

  it("returns null when the featured workflow is no longer published (skipped)", async () => {
    limitMock.mockResolvedValueOnce({ data: [candidate], error: null });
    inMock.mockResolvedValueOnce({ data: [], error: null }); // published-only query → empty
    expect(await getWorkflowOfTheDay()).toBeNull();
  });

  it("scopes to a profession for the community page", async () => {
    limitMock.mockResolvedValueOnce({ data: [candidate], error: null });
    inMock.mockResolvedValueOnce({ data: [publishedRow], error: null });
    inMock.mockResolvedValueOnce({
      data: [{ id: "n1", workflow_id: "w1" }],
      error: null,
    });
    inMock.mockResolvedValueOnce({
      data: [{ node_id: "n1", kind: "text", storage_path: null }],
      error: null,
    });

    const wotd = await getWorkflowOfTheDay({ professionId: "gd" });
    expect(wotd?.id).toBe("w1");
    // The candidate query filtered by the profession id.
    expect(eqMock).toHaveBeenCalledWith("profession_id", "gd");
  });
});
