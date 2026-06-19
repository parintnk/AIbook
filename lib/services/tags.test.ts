import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn();
const queryMock = vi.fn(); // resolves an awaited filter chain (the list reads)

// Self-chaining, thenable builder: filter/shape methods return the builder; `.maybeSingle()`
// is the configurable single-row terminal; `await`-ing a chain resolves `queryMock()`.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const b = {
      select: () => b,
      eq: () => b,
      in: () => b,
      order: () => b,
      maybeSingle: () => maybeSingleMock(),
      // biome-ignore lint/suspicious/noThenProperty: the mock builder is intentionally thenable so an awaited query chain resolves.
      then: (resolve: (v: unknown) => unknown) => resolve(queryMock()),
    };
    return { from: () => b };
  }),
}));

// listTags now uses the cookie-free anon client + unstable_cache. Mock the anon client to
// resolve the same `queryMock`, and passthrough unstable_cache so the wrapped fn runs.
vi.mock("@/lib/supabase/anon", () => ({
  createAnonClient: () => {
    const b = {
      select: () => b,
      eq: () => b,
      in: () => b,
      order: () => b,
      // biome-ignore lint/suspicious/noThenProperty: intentionally thenable so an awaited query chain resolves.
      then: (resolve: (v: unknown) => unknown) => resolve(queryMock()),
    };
    return { from: () => b };
  },
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { createClient } from "@/lib/supabase/server";
import { listProfessionTags, listTags, workflowIdsForTag } from "./tags";

beforeEach(() => {
  vi.clearAllMocks();
  queryMock.mockReturnValue({ data: [], error: null });
});

describe("listTags", () => {
  it("returns the curated tag rows", async () => {
    queryMock.mockReturnValueOnce({
      data: [{ id: "t1", slug: "design", label: "Design" }],
      error: null,
    });
    expect(await listTags()).toEqual([
      { id: "t1", slug: "design", label: "Design" },
    ]);
  });
});

describe("listProfessionTags", () => {
  it("returns [] for an unknown profession slug (no further reads)", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null });
    expect(await listProfessionTags("nope")).toEqual([]);
  });

  it("returns [] when the profession has no published workflows", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "p1" } });
    queryMock.mockReturnValueOnce({ data: [], error: null }); // workflows
    expect(await listProfessionTags("web-developer")).toEqual([]);
  });

  it("resolves the distinct tags present on the profession's published work", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "p1" } });
    queryMock
      .mockReturnValueOnce({ data: [{ id: "w1" }, { id: "w2" }] }) // workflows
      .mockReturnValueOnce({
        data: [{ tag_id: "t1" }, { tag_id: "t1" }, { tag_id: "t2" }],
      }) // workflow_tags (dup t1)
      .mockReturnValueOnce({
        data: [
          { id: "t1", slug: "design", label: "Design" },
          { id: "t2", slug: "icons", label: "Icons" },
        ],
      }); // tags
    const tags = await listProfessionTags("graphic-designer");
    expect(tags.map((t) => t.slug)).toEqual(["design", "icons"]);
  });
});

describe("workflowIdsForTag", () => {
  it("returns [] for an unknown tag (the feed short-circuits)", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null });
    const supabase = await createClient();
    expect(await workflowIdsForTag(supabase, "bogus")).toEqual([]);
  });

  it("returns the workflow ids carrying the tag", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "t1" } });
    queryMock.mockReturnValueOnce({
      data: [{ workflow_id: "w1" }, { workflow_id: "w2" }],
    });
    const supabase = await createClient();
    expect(await workflowIdsForTag(supabase, "design")).toEqual(["w1", "w2"]);
  });
});
