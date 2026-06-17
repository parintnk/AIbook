import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn();
const singleMock = vi.fn();
const queryMock = vi.fn(); // resolves an awaited chain (list reads + awaited upsert / item-insert)
const getUserMock = vi.fn();
const insertSpy = vi.fn();
const upsertSpy = vi.fn();

// One self-chaining builder. Filter/shape methods return the builder; the terminals are
// `.maybeSingle()` (removeFromBoard), `.single()` (createBoard's board insert), and `await`-ing
// the chain itself (thenable → queryMock — the list reads, the awaited upsert, the item insert).
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const b = {
      select: () => b,
      insert: (...a: unknown[]) => {
        insertSpy(...a);
        return b;
      },
      upsert: (...a: unknown[]) => {
        upsertSpy(...a);
        return b;
      },
      delete: () => b,
      eq: () => b,
      in: () => b,
      order: () => b,
      maybeSingle: () => maybeSingleMock(),
      single: () => singleMock(),
      // biome-ignore lint/suspicious/noThenProperty: the mock builder is intentionally thenable.
      then: (resolve: (v: unknown) => unknown) => resolve(queryMock()),
    };
    return { from: () => b, auth: { getUser: getUserMock } };
  }),
}));

import {
  createBoardAndSave,
  getSavedWorkflowIds,
  listMyBoardsForWorkflow,
  removeFromBoard,
  saveToBoard,
} from "./boards";

const USER = { data: { user: { id: "u1" } } };
const NO_USER = { data: { user: null } };

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue(USER);
  queryMock.mockReturnValue({ data: [], error: null });
  maybeSingleMock.mockReturnValue({ data: null, error: null });
  singleMock.mockReturnValue({ data: null, error: null });
});

describe("saveToBoard", () => {
  it("requires auth", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await saveToBoard("b1", "w1")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("upserts idempotently (ON CONFLICT DO NOTHING) and returns ok", async () => {
    queryMock.mockReturnValueOnce({ error: null });
    expect(await saveToBoard("b1", "w1")).toEqual({ ok: true });
    expect(upsertSpy).toHaveBeenCalledWith(
      { board_id: "b1", workflow_id: "w1" },
      { onConflict: "board_id,workflow_id", ignoreDuplicates: true },
    );
  });

  it("maps a db error", async () => {
    queryMock.mockReturnValueOnce({ error: { message: "boom" } });
    expect(await saveToBoard("b1", "w1")).toEqual({
      ok: false,
      error: "db_error",
    });
  });
});

describe("removeFromBoard", () => {
  it("requires auth", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await removeFromBoard("b1", "w1")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("returns not_found when nothing was deleted", async () => {
    maybeSingleMock.mockReturnValueOnce({ data: null, error: null });
    expect(await removeFromBoard("b1", "w1")).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("returns ok when a row was deleted", async () => {
    maybeSingleMock.mockReturnValueOnce({
      data: { board_id: "b1" },
      error: null,
    });
    expect(await removeFromBoard("b1", "w1")).toEqual({ ok: true });
  });
});

describe("createBoardAndSave", () => {
  it("rejects an empty/whitespace name without touching the DB", async () => {
    expect(await createBoardAndSave("   ", false, "w1")).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("requires auth (after a valid name)", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await createBoardAndSave("My Board", false, "w1")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("creates the board then saves the workflow into it", async () => {
    singleMock.mockReturnValueOnce({ data: { id: "b9" }, error: null });
    queryMock.mockReturnValueOnce({ error: null }); // the item insert
    expect(await createBoardAndSave("My Board", true, "w1")).toEqual({
      ok: true,
      boardId: "b9",
    });
    expect(insertSpy).toHaveBeenCalledWith({
      name: "My Board",
      is_public: true,
    });
    expect(insertSpy).toHaveBeenCalledWith({
      board_id: "b9",
      workflow_id: "w1",
    });
  });

  it("maps a db error on the board insert", async () => {
    singleMock.mockReturnValueOnce({ data: null, error: { message: "x" } });
    expect(await createBoardAndSave("My Board", false, "w1")).toEqual({
      ok: false,
      error: "db_error",
    });
  });
});

describe("listMyBoardsForWorkflow", () => {
  it("returns [] for anon", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await listMyBoardsForWorkflow("w1")).toEqual([]);
  });

  it("annotates each board with `contains` for the workflow", async () => {
    queryMock
      .mockReturnValueOnce({
        data: [
          { id: "b1", name: "B1", is_public: false, item_count: 2 },
          { id: "b2", name: "B2", is_public: true, item_count: 0 },
        ],
        error: null,
      })
      .mockReturnValueOnce({ data: [{ board_id: "b1" }], error: null });
    const res = await listMyBoardsForWorkflow("w1");
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ id: "b1", contains: true, itemCount: 2 });
    expect(res[1]).toMatchObject({ id: "b2", contains: false });
  });

  it("short-circuits to [] when the user has no boards", async () => {
    queryMock.mockReturnValueOnce({ data: [], error: null });
    expect(await listMyBoardsForWorkflow("w1")).toEqual([]);
  });
});

describe("getSavedWorkflowIds", () => {
  it("returns an empty set for no input ids", async () => {
    expect((await getSavedWorkflowIds([])).size).toBe(0);
  });

  it("returns an empty set for anon", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect((await getSavedWorkflowIds(["w1"])).size).toBe(0);
  });

  it("returns only the ids saved in my boards", async () => {
    queryMock
      .mockReturnValueOnce({ data: [{ id: "b1" }], error: null }) // my boards
      .mockReturnValueOnce({ data: [{ workflow_id: "w1" }], error: null }); // items
    const res = await getSavedWorkflowIds(["w1", "w2"]);
    expect(res.has("w1")).toBe(true);
    expect(res.has("w2")).toBe(false);
  });

  it("returns an empty set when the user has no boards", async () => {
    queryMock.mockReturnValueOnce({ data: [], error: null });
    expect((await getSavedWorkflowIds(["w1"])).size).toBe(0);
  });
});
