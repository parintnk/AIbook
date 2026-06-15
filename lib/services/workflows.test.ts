import { beforeEach, describe, expect, it, vi } from "vitest";

const singleMock = vi.fn();
const maybeSingleMock = vi.fn();
const orderMock = vi.fn();
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
      order: orderMock,
      single: singleMock,
      maybeSingle: maybeSingleMock,
    };
    return { from: () => b, rpc: rpcMock, auth: { getUser: getUserMock } };
  }),
}));

import {
  createDraft,
  deleteDraft,
  getMyDraft,
  listMyDrafts,
  publishWorkflow,
  updateDraft,
} from "./workflows";

const USER = { data: { user: { id: "u1" } } };
const NO_USER = { data: { user: null } };
const input = { title: "X", summary: null, profession_id: "p1" };

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
