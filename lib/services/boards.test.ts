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
      update: () => b,
      delete: () => b,
      eq: () => b,
      in: () => b,
      order: () => b,
      range: () => b,
      limit: () => b,
      maybeSingle: () => maybeSingleMock(),
      single: () => singleMock(),
      // biome-ignore lint/suspicious/noThenProperty: the mock builder is intentionally thenable.
      then: (resolve: (v: unknown) => unknown) => resolve(queryMock()),
    };
    return { from: () => b, auth: { getUser: getUserMock } };
  }),
}));

import {
  createBoard,
  createBoardAndSave,
  deleteBoard,
  followBoard,
  getBoard,
  getSavedWorkflowIds,
  listBoardItems,
  listMyBoards,
  listMyBoardsForWorkflow,
  removeFromBoard,
  renameBoard,
  reorderBoardItems,
  saveToBoard,
  setBoardVisibility,
  unfollowBoard,
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

// ── Story 8.2 — management + following ──────────────────────────────────────

describe("listMyBoards", () => {
  it("returns empty for anon", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await listMyBoards()).toEqual({ items: [], total: 0 });
  });

  it("maps boards + annotates lastSavedAt from the most-recent save", async () => {
    queryMock
      .mockReturnValueOnce({
        data: [
          {
            id: "b1",
            name: "B1",
            is_public: true,
            item_count: 2,
            follower_count: 5,
            created_at: "t1",
          },
        ],
        count: 1,
      })
      .mockReturnValueOnce({
        data: [
          { board_id: "b1", saved_at: "2026-06-02" },
          { board_id: "b1", saved_at: "2026-06-01" },
        ],
      });
    const res = await listMyBoards();
    expect(res.total).toBe(1);
    expect(res.items[0]).toMatchObject({
      id: "b1",
      followerCount: 5,
      lastSavedAt: "2026-06-02",
    });
  });
});

describe("getBoard", () => {
  it("returns not_found when the board is not visible", async () => {
    maybeSingleMock.mockReturnValueOnce({ data: null, error: null });
    expect(await getBoard("b1")).toEqual({ ok: false, error: "not_found" });
  });

  it("returns the board with isOwner true for the owner (no follow probe)", async () => {
    maybeSingleMock
      .mockReturnValueOnce({
        data: {
          id: "b1",
          name: "Mine",
          is_public: false,
          item_count: 3,
          follower_count: 0,
          created_at: "t",
          owner_id: "u1",
          owner: { handle: "me" },
        },
        error: null,
      })
      .mockReturnValueOnce({ data: { saved_at: "s" }, error: null });
    const res = await getBoard("b1");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.board).toMatchObject({
        isOwner: true,
        isFollowing: false,
        ownerHandle: "me",
        lastSavedAt: "s",
      });
    }
  });
});

describe("listBoardItems", () => {
  it("maps published items to cards (thumbs fall back when no nodes)", async () => {
    queryMock
      .mockReturnValueOnce({
        data: [
          {
            workflow: {
              id: "w1",
              title: "T",
              fork_count: 4,
              worked_score: 0.9,
              tried_count: 10,
              published_at: "p",
              profession: null,
              author: null,
            },
          },
        ],
        count: 1,
      })
      .mockReturnValueOnce({ data: [] }); // resolveThumbs: no first nodes
    const res = await listBoardItems("b1");
    expect(res.total).toBe(1);
    expect(res.items[0]).toMatchObject({ id: "w1", forkCount: 4 });
    expect(res.items[0]?.thumb).toEqual({ kind: null, url: null });
  });
});

describe("createBoard", () => {
  it("rejects an empty name without touching the DB", async () => {
    expect(await createBoard("   ", false)).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("requires auth", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await createBoard("My Board", true)).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("inserts and returns the new id", async () => {
    singleMock.mockReturnValueOnce({ data: { id: "b9" }, error: null });
    expect(await createBoard("My Board", true)).toEqual({
      ok: true,
      boardId: "b9",
    });
    expect(insertSpy).toHaveBeenCalledWith({
      name: "My Board",
      is_public: true,
    });
  });
});

describe("renameBoard", () => {
  it("rejects an empty name", async () => {
    expect(await renameBoard("b1", "  ")).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("returns not_found when no row is updated", async () => {
    maybeSingleMock.mockReturnValueOnce({ data: null, error: null });
    expect(await renameBoard("b1", "New name")).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("returns ok when the board is renamed", async () => {
    maybeSingleMock.mockReturnValueOnce({ data: { id: "b1" }, error: null });
    expect(await renameBoard("b1", "New name")).toEqual({ ok: true });
  });
});

describe("setBoardVisibility", () => {
  it("returns ok when toggled", async () => {
    maybeSingleMock.mockReturnValueOnce({ data: { id: "b1" }, error: null });
    expect(await setBoardVisibility("b1", true)).toEqual({ ok: true });
  });

  it("returns not_found when no row matches", async () => {
    maybeSingleMock.mockReturnValueOnce({ data: null, error: null });
    expect(await setBoardVisibility("b1", true)).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});

describe("deleteBoard", () => {
  it("returns not_found when nothing was deleted", async () => {
    maybeSingleMock.mockReturnValueOnce({ data: null, error: null });
    expect(await deleteBoard("b1")).toEqual({ ok: false, error: "not_found" });
  });

  it("returns ok when a board was deleted", async () => {
    maybeSingleMock.mockReturnValueOnce({ data: { id: "b1" }, error: null });
    expect(await deleteBoard("b1")).toEqual({ ok: true });
  });
});

describe("reorderBoardItems", () => {
  // valid UUIDs — reorderBoardItemsSchema validates the workflow ids before anything else.
  const W1 = "11111111-1111-4111-8111-111111111111";
  const W2 = "22222222-2222-4222-9222-222222222222";

  it("rejects a non-UUID payload before touching auth/DB", async () => {
    expect(await reorderBoardItems("b1", ["w1"])).toEqual({
      ok: false,
      error: "db_error",
    });
  });

  it("requires auth", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await reorderBoardItems("b1", [W1])).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("returns ok when every per-row update succeeds", async () => {
    expect(await reorderBoardItems("b1", [W1, W2])).toEqual({ ok: true });
  });

  it("maps a db error mid-loop", async () => {
    queryMock.mockReturnValueOnce({ error: { message: "boom" } });
    expect(await reorderBoardItems("b1", [W1, W2])).toEqual({
      ok: false,
      error: "db_error",
    });
  });
});

describe("followBoard", () => {
  it("requires auth", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await followBoard("b1")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("upserts idempotently (board_id only — follower auto-stamped)", async () => {
    queryMock.mockReturnValueOnce({ error: null });
    expect(await followBoard("b1")).toEqual({ ok: true });
    expect(upsertSpy).toHaveBeenCalledWith(
      { board_id: "b1" },
      { onConflict: "board_id,follower_id", ignoreDuplicates: true },
    );
  });

  it("maps a db error", async () => {
    queryMock.mockReturnValueOnce({ error: { message: "x" } });
    expect(await followBoard("b1")).toEqual({ ok: false, error: "db_error" });
  });
});

describe("unfollowBoard", () => {
  it("returns not_found when not following", async () => {
    maybeSingleMock.mockReturnValueOnce({ data: null, error: null });
    expect(await unfollowBoard("b1")).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("returns ok when a follow row was removed", async () => {
    maybeSingleMock.mockReturnValueOnce({
      data: { board_id: "b1" },
      error: null,
    });
    expect(await unfollowBoard("b1")).toEqual({ ok: true });
  });
});
