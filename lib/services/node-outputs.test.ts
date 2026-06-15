import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn();
const listMock = vi.fn();
const getUserMock = vi.fn();

// Self-chaining Supabase builder (mirrors workflow-nodes.test.ts). Queries that
// terminate on `.maybeSingle()` use maybeSingleMock; one that terminates on `.eq()`
// (listOutputsForWorkflow) is awaitable → resolves to listMock().
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const b = {
      insert: () => b,
      select: () => b,
      update: () => b,
      delete: () => b,
      eq: () => b,
      maybeSingle: maybeSingleMock,
      // biome-ignore lint/suspicious/noThenProperty: builder is intentionally awaitable so a query terminating on .eq() resolves to listMock()
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(listMock()).then(onF, onR),
    };
    return { from: () => b, auth: { getUser: getUserMock } };
  }),
}));

import {
  deleteNodeOutput,
  deriveThumbPath,
  getNodeOutput,
  upsertBinaryOutput,
  upsertTextOutput,
} from "./node-outputs";

const USER = { data: { user: { id: "u1" } } };
const NO_USER = { data: { user: null } };
const OWNS = { data: { id: "n1" }, error: null }; // ownsDraftForNode → truthy

const binary = {
  nodeId: "n1",
  kind: "image" as const,
  storagePath: "w1/n1/main.webp",
  mime: "image/webp",
  bytes: 1234,
};

beforeEach(() => vi.clearAllMocks());

describe("upsertBinaryOutput", () => {
  it("requires authentication", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await upsertBinaryOutput(binary)).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("returns not_found when the caller doesn't own the node's draft", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null }); // ownsDraftForNode
    expect(await upsertBinaryOutput(binary)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("UPDATEs the existing output (replace path)", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock
      .mockResolvedValueOnce(OWNS) // ownsDraftForNode
      .mockResolvedValueOnce({
        data: { id: "o1", kind: "image" },
        error: null,
      }); // update
    const res = await upsertBinaryOutput(binary);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.id).toBe("o1");
  });

  it("INSERTs when no output exists yet (first upload)", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock
      .mockResolvedValueOnce(OWNS) // ownsDraftForNode
      .mockResolvedValueOnce({ data: null, error: null }) // update → zero rows
      .mockResolvedValueOnce({ data: { id: "o2" }, error: null }); // insert
    const res = await upsertBinaryOutput(binary);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.id).toBe("o2");
  });

  it("maps the kind/payload CHECK (23514) to invalid_output", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock
      .mockResolvedValueOnce(OWNS)
      .mockResolvedValueOnce({ data: null, error: { code: "23514" } }); // update CHECK
    expect(await upsertBinaryOutput(binary)).toEqual({
      ok: false,
      error: "invalid_output",
    });
  });
});

describe("upsertTextOutput", () => {
  it("writes a text output", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock
      .mockResolvedValueOnce(OWNS)
      .mockResolvedValueOnce({ data: { id: "t1", kind: "text" }, error: null });
    const res = await upsertTextOutput({ nodeId: "n1", text: "hello" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.kind).toBe("text");
  });
});

describe("deleteNodeOutput", () => {
  it("returns not_found when nothing was deleted", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await deleteNodeOutput("n1")).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("returns the freed main + derived thumb paths for a binary output", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({
      data: { storage_path: "w1/n1/main.webp" },
      error: null,
    });
    expect(await deleteNodeOutput("n1")).toEqual({
      ok: true,
      freedPaths: ["w1/n1/main.webp", "w1/n1/thumb.webp"],
    });
  });

  it("returns no freed paths for a text output (null storage_path)", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({
      data: { storage_path: null },
      error: null,
    });
    expect(await deleteNodeOutput("n1")).toEqual({ ok: true, freedPaths: [] });
  });
});

describe("getNodeOutput", () => {
  it("returns the row when present", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "o1" }, error: null });
    expect(await getNodeOutput("n1")).toEqual({ id: "o1" });
  });

  it("returns null when absent", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await getNodeOutput("n1")).toBeNull();
  });
});

describe("deriveThumbPath", () => {
  it("swaps the main filename for thumb.webp in the same folder", () => {
    expect(deriveThumbPath("w1/n1/main.webp")).toBe("w1/n1/thumb.webp");
    expect(deriveThumbPath("w1/n1/main.mp4")).toBe("w1/n1/thumb.webp");
  });
});
