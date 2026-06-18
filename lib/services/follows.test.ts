import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn();
const queryMock = vi.fn(); // resolves an awaited chain (list reads, the awaited upsert)
const getUserMock = vi.fn();
const upsertSpy = vi.fn();

// One self-chaining builder (the boards.test.ts harness). Filter/shape methods return the builder;
// the terminals are `.maybeSingle()` (unfollow / getFollowState) and `await`-ing the chain itself
// (thenable → queryMock — the list reads, the awaited upsert).
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const b = {
      select: () => b,
      upsert: (...a: unknown[]) => {
        upsertSpy(...a);
        return b;
      },
      delete: () => b,
      eq: () => b,
      in: () => b,
      order: () => b,
      range: () => b,
      maybeSingle: () => maybeSingleMock(),
      // biome-ignore lint/suspicious/noThenProperty: the mock builder is intentionally thenable.
      then: (resolve: (v: unknown) => unknown) => resolve(queryMock()),
    };
    return { from: () => b, auth: { getUser: getUserMock } };
  }),
}));

import {
  followUser,
  getFollowingIds,
  getFollowState,
  listFollowers,
  listFollowing,
  unfollowUser,
} from "./follows";

const USER = { data: { user: { id: "u1" } } };
const NO_USER = { data: { user: null } };

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue(USER);
  queryMock.mockReturnValue({ data: [], error: null });
  maybeSingleMock.mockReturnValue({ data: null, error: null });
});

describe("followUser", () => {
  it("requires auth", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await followUser("t1")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("upserts idempotently (ON CONFLICT DO NOTHING) and returns ok", async () => {
    queryMock.mockReturnValueOnce({ error: null });
    expect(await followUser("t1")).toEqual({ ok: true });
    expect(upsertSpy).toHaveBeenCalledWith(
      { following_id: "t1" },
      { onConflict: "follower_id,following_id", ignoreDuplicates: true },
    );
  });

  it("maps a db error (e.g. an RLS self-follow rejection)", async () => {
    queryMock.mockReturnValueOnce({ error: { message: "boom" } });
    expect(await followUser("u1")).toEqual({ ok: false, error: "db_error" });
  });
});

describe("unfollowUser", () => {
  it("requires auth", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await unfollowUser("t1")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("returns not_found when nothing was deleted (idempotent)", async () => {
    maybeSingleMock.mockReturnValueOnce({ data: null, error: null });
    expect(await unfollowUser("t1")).toEqual({ ok: false, error: "not_found" });
  });

  it("returns ok when a row was deleted", async () => {
    maybeSingleMock.mockReturnValueOnce({
      data: { following_id: "t1" },
      error: null,
    });
    expect(await unfollowUser("t1")).toEqual({ ok: true });
  });
});

describe("getFollowState", () => {
  it("is false for anon", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await getFollowState("t1")).toBe(false);
  });

  it("is true when a follow row exists", async () => {
    maybeSingleMock.mockReturnValueOnce({
      data: { following_id: "t1" },
      error: null,
    });
    expect(await getFollowState("t1")).toBe(true);
  });

  it("is false when no row exists", async () => {
    maybeSingleMock.mockReturnValueOnce({ data: null, error: null });
    expect(await getFollowState("t1")).toBe(false);
  });
});

describe("getFollowingIds", () => {
  it("is empty for an empty input (no query)", async () => {
    expect((await getFollowingIds([])).size).toBe(0);
  });

  it("is empty for anon", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect((await getFollowingIds(["a", "b"])).size).toBe(0);
  });

  it("returns the subset the caller follows", async () => {
    queryMock.mockReturnValueOnce({
      data: [{ following_id: "a" }, { following_id: "c" }],
      error: null,
    });
    const set = await getFollowingIds(["a", "b", "c"]);
    expect(set.has("a")).toBe(true);
    expect(set.has("b")).toBe(false);
    expect(set.has("c")).toBe(true);
  });
});

describe("listFollowers", () => {
  it("returns {items,total} enriched + ordered + isFollowing per row", async () => {
    queryMock
      // edge rows (newest-first)
      .mockReturnValueOnce({
        data: [{ follower_id: "f1" }, { follower_id: "f2" }],
        count: 2,
        error: null,
      })
      // profiles enrichment (arbitrary order → must map back through the edge order)
      .mockReturnValueOnce({
        data: [
          {
            id: "f2",
            handle: "bob",
            display_name: "Bob",
            avatar_url: null,
            primary_profession: { name: "Marketer" },
          },
          {
            id: "f1",
            handle: "alice",
            display_name: "Alice",
            avatar_url: null,
            primary_profession: null,
          },
        ],
        error: null,
      })
      // getFollowingIds: I follow f1 only
      .mockReturnValueOnce({ data: [{ following_id: "f1" }], error: null });

    const res = await listFollowers("p1");
    expect(res.total).toBe(2);
    expect(res.items.map((i) => i.id)).toEqual(["f1", "f2"]); // edge order preserved
    expect(res.items[0]).toMatchObject({ handle: "alice", isFollowing: true });
    expect(res.items[1]).toMatchObject({
      handle: "bob",
      professionName: "Marketer",
      isFollowing: false,
    });
  });

  it("returns empty when there are no followers", async () => {
    queryMock.mockReturnValueOnce({ data: [], count: 0, error: null });
    expect(await listFollowers("p1")).toEqual({ items: [], total: 0 });
  });
});

describe("listFollowing", () => {
  it("returns {items,total} (enriched by following_id)", async () => {
    queryMock
      .mockReturnValueOnce({
        data: [{ following_id: "g1" }],
        count: 1,
        error: null,
      })
      .mockReturnValueOnce({
        data: [
          {
            id: "g1",
            handle: "carol",
            display_name: null,
            avatar_url: null,
            primary_profession: null,
          },
        ],
        error: null,
      })
      .mockReturnValueOnce({ data: [], error: null });
    const res = await listFollowing("p1");
    expect(res.total).toBe(1);
    expect(res.items[0]).toMatchObject({
      id: "g1",
      handle: "carol",
      isFollowing: false,
    });
  });
});
