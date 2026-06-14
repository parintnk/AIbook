import { beforeEach, describe, expect, it, vi } from "vitest";

const singleMock = vi.fn();
const maybeSingleMock = vi.fn();
const listMock = vi.fn();
const getUserMock = vi.fn();

// One self-chaining builder covering every query the service uses. `.order()` is
// chainable (listDraftNodes chains two for the idx + created_at tiebreak), and the
// builder itself is awaitable (thenable) → resolves to listMock() for any query
// that terminates on `.order()`; `.single` / `.maybeSingle` are explicit promise
// terminals. Built inside createClient (runtime) so the hoisted factory doesn't
// touch the mock consts before they're initialized. (Mirrors workflows.test.ts.)
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const b = {
      insert: () => b,
      select: () => b,
      update: () => b,
      delete: () => b,
      eq: () => b,
      order: () => b,
      single: singleMock,
      maybeSingle: maybeSingleMock,
      // biome-ignore lint/suspicious/noThenProperty: builder is intentionally awaitable so a query terminating on .order() resolves to listMock()
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(listMock()).then(onF, onR),
    };
    return { from: () => b, auth: { getUser: getUserMock } };
  }),
}));

import {
  createNode,
  deleteNode,
  listDraftNodes,
  updateNode,
} from "./workflow-nodes";

const USER = { data: { user: { id: "u1" } } };
const NO_USER = { data: { user: null } };
const input = {
  step_title: null,
  tool_name: "ChatGPT",
  tool_version: null,
  prompt: "a prompt",
  purpose: "why this step",
  est_time: null,
  est_cost: null,
  notes: null,
  note_lang: null,
  tool_url: null,
};

beforeEach(() => vi.clearAllMocks());

describe("listDraftNodes", () => {
  it("returns [] when unauthenticated (no query)", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await listDraftNodes("w1")).toEqual([]);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("returns the workflow's nodes ordered by idx", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    listMock.mockResolvedValueOnce({
      data: [{ id: "n1" }, { id: "n2" }],
      error: null,
    });
    expect(await listDraftNodes("w1")).toHaveLength(2);
  });
});

describe("createNode", () => {
  it("requires authentication", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await createNode("w1", input)).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("returns not_found when the caller does not own the draft", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null }); // ownsDraft
    expect(await createNode("w1", input)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("assigns idx = max+1 and returns the new id", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "w1" }, error: null }); // ownsDraft
    listMock.mockResolvedValueOnce({ data: [{ idx: 2 }], error: null }); // max idx
    singleMock.mockResolvedValueOnce({ data: { id: "n9" }, error: null }); // insert
    expect(await createNode("w1", input)).toEqual({ ok: true, id: "n9" });
  });

  it("starts idx at 0 for the first node", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "w1" }, error: null });
    listMock.mockResolvedValueOnce({ data: [], error: null });
    singleMock.mockResolvedValueOnce({ data: { id: "n1" }, error: null });
    expect(await createNode("w1", input)).toEqual({ ok: true, id: "n1" });
  });

  it("maps a bad workflow FK to invalid_workflow", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "w1" }, error: null });
    listMock.mockResolvedValueOnce({ data: [], error: null });
    singleMock.mockResolvedValueOnce({ data: null, error: { code: "23503" } });
    expect(await createNode("w1", input)).toEqual({
      ok: false,
      error: "invalid_workflow",
    });
  });
});

describe("updateNode", () => {
  it("returns not_found on a zero-row update (RLS filtered / gone)", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await updateNode("n1", input)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("succeeds when a row is updated", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "n1" }, error: null });
    expect(await updateNode("n1", input)).toEqual({ ok: true, id: "n1" });
  });
});

describe("deleteNode", () => {
  it("returns not_found when nothing was deleted", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await deleteNode("n1")).toEqual({ ok: false, error: "not_found" });
  });

  it("succeeds when a row is deleted", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "n1" }, error: null });
    expect(await deleteNode("n1")).toEqual({ ok: true, id: "n1" });
  });
});
