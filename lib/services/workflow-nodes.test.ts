import { beforeEach, describe, expect, it, vi } from "vitest";

const singleMock = vi.fn();
const maybeSingleMock = vi.fn();
const listMock = vi.fn();
const rpcMock = vi.fn();
const getUserMock = vi.fn();

// One self-chaining builder covering every query the service uses. `.order()` is
// chainable (listDraftNodes chains two for the idx + created_at tiebreak), and the
// builder itself is awaitable (thenable) → resolves to listMock() for any query
// that terminates on `.order()`; `.single` / `.maybeSingle` are explicit promise
// terminals. `rpc` lives on the client (createNode/reorder/positions use RPCs).
// Built inside createClient (runtime) so the hoisted factory doesn't touch the
// mock consts before they're initialized. (Mirrors workflows.test.ts.)
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
    return { from: () => b, rpc: rpcMock, auth: { getUser: getUserMock } };
  }),
}));

import {
  createNode,
  deleteNode,
  listDraftNodes,
  listPublishedNodes,
  reorderNodes,
  updateNode,
  updateNodePositions,
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

describe("listPublishedNodes", () => {
  it("queries without an auth guard (anon public viewer)", async () => {
    listMock.mockResolvedValueOnce({
      data: [{ id: "n1" }, { id: "n2" }],
      error: null,
    });
    expect(await listPublishedNodes("w1")).toHaveLength(2);
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

describe("createNode (append_workflow_node RPC)", () => {
  it("requires authentication", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await createNode("w1", input)).toEqual({
      ok: false,
      error: "not_authenticated",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns the new id from the RPC", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({ data: "n9", error: null });
    expect(await createNode("w1", input)).toEqual({ ok: true, id: "n9" });
    expect(rpcMock).toHaveBeenCalledWith(
      "append_workflow_node",
      expect.objectContaining({ p_workflow_id: "w1", p_tool_name: "ChatGPT" }),
    );
  });

  it("maps the RPC not-owner (42501) to not_found", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect(await createNode("w1", input)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("maps other RPC errors to db_error", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
    expect(await createNode("w1", input)).toEqual({
      ok: false,
      error: "db_error",
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

describe("updateNodePositions (RPC)", () => {
  it("succeeds via the update_node_positions RPC", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({ error: null });
    expect(
      await updateNodePositions("w1", [{ id: "n1", pos_x: 10, pos_y: 20 }]),
    ).toEqual({ ok: true, id: "w1" });
  });

  it("maps not-owner (42501) to not_found", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({ error: { code: "42501" } });
    expect(await updateNodePositions("w1", [])).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});

describe("reorderNodes (RPC)", () => {
  it("succeeds via the reorder_workflow_nodes RPC", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({ error: null });
    expect(await reorderNodes("w1", ["n2", "n1"])).toEqual({
      ok: true,
      id: "w1",
    });
  });

  it("maps a node_set_mismatch (22023) to db_error", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    rpcMock.mockResolvedValueOnce({ error: { code: "22023" } });
    expect(await reorderNodes("w1", ["n1"])).toEqual({
      ok: false,
      error: "db_error",
    });
  });
});
