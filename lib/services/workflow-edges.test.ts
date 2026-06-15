import { beforeEach, describe, expect, it, vi } from "vitest";

const singleMock = vi.fn();
const maybeSingleMock = vi.fn();
const listMock = vi.fn();
const getUserMock = vi.fn();

// Self-chaining builder (mirrors workflow-nodes.test.ts) with `.in()` added. The
// builder is awaitable (thenable) → a query terminating on .order()/.in() resolves
// to listMock(); .single/.maybeSingle are explicit promise terminals.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const b = {
      insert: () => b,
      select: () => b,
      update: () => b,
      delete: () => b,
      eq: () => b,
      in: () => b,
      order: () => b,
      single: singleMock,
      maybeSingle: maybeSingleMock,
      // biome-ignore lint/suspicious/noThenProperty: builder is intentionally awaitable so a query terminating on .order()/.in() resolves to listMock()
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(listMock()).then(onF, onR),
    };
    return { from: () => b, auth: { getUser: getUserMock } };
  }),
}));

import {
  createEdge,
  deleteEdge,
  listEdges,
  listPublishedEdges,
} from "./workflow-edges";

const USER = { data: { user: { id: "u1" } } };
const NO_USER = { data: { user: null } };
const OWNS = { data: { id: "w1" }, error: null }; // ownsDraft → truthy

beforeEach(() => vi.clearAllMocks());

describe("listEdges", () => {
  it("returns [] when unauthenticated (no query)", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await listEdges("w1")).toEqual([]);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("returns the workflow's edges", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    listMock.mockResolvedValueOnce({ data: [{ id: "e1" }], error: null });
    expect(await listEdges("w1")).toHaveLength(1);
  });
});

describe("listPublishedEdges", () => {
  it("queries without an auth guard (anon public viewer)", async () => {
    listMock.mockResolvedValueOnce({ data: [{ id: "e1" }], error: null });
    expect(await listPublishedEdges("w1")).toHaveLength(1);
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

describe("createEdge", () => {
  it("requires authentication", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await createEdge("w1", "a", "b")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("rejects a self-edge before any query", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    expect(await createEdge("w1", "a", "a")).toEqual({
      ok: false,
      error: "self_edge",
    });
  });

  it("returns not_found when the caller does not own the draft", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null }); // ownsDraft
    expect(await createEdge("w1", "a", "b")).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("returns invalid_nodes when an endpoint is not in the workflow", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce(OWNS);
    listMock.mockResolvedValueOnce({ data: [{ id: "a" }], error: null }); // only 1 of 2
    expect(await createEdge("w1", "a", "b")).toEqual({
      ok: false,
      error: "invalid_nodes",
    });
  });

  it("creates the edge and returns its id", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce(OWNS);
    listMock.mockResolvedValueOnce({
      data: [{ id: "a" }, { id: "b" }],
      error: null,
    });
    singleMock.mockResolvedValueOnce({ data: { id: "e9" }, error: null });
    expect(await createEdge("w1", "a", "b")).toEqual({ ok: true, id: "e9" });
  });

  it("maps a unique violation to duplicate", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce(OWNS);
    listMock.mockResolvedValueOnce({
      data: [{ id: "a" }, { id: "b" }],
      error: null,
    });
    singleMock.mockResolvedValueOnce({ data: null, error: { code: "23505" } });
    expect(await createEdge("w1", "a", "b")).toEqual({
      ok: false,
      error: "duplicate",
    });
  });
});

describe("deleteEdge", () => {
  it("returns not_found on a zero-row delete", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await deleteEdge("e1")).toEqual({ ok: false, error: "not_found" });
  });

  it("succeeds when a row is deleted", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "e1" }, error: null });
    expect(await deleteEdge("e1")).toEqual({ ok: true, id: "e1" });
  });
});
