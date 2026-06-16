import { beforeEach, describe, expect, it, vi } from "vitest";

// A chain-aware supabase mock: each `.from(table)` returns a builder that records its
// chain (head/null-parent/in-parent/insert/delete) and resolves at the terminal
// (range/single/maybeSingle/await) to the per-test fixture for that query shape.
type Opts = {
  user?: { id: string } | null;
  count?: number;
  topLevel?: unknown[];
  replies?: unknown[];
  likes?: { comment_id: string }[];
  existingLike?: { comment_id: string } | null;
  insertResult?: unknown;
  insertError?: unknown;
  insertLikeError?: unknown;
  deleteError?: unknown;
};

let opts: Opts = {};

function resolve(table: string, s: Record<string, boolean>, terminal: string) {
  if (table === "comments") {
    if (s.head) return { count: opts.count ?? 0 };
    if (s.insert)
      return {
        data: opts.insertResult ?? null,
        error: opts.insertError ?? null,
      };
    if (s.nullParent) return { data: opts.topLevel ?? [], error: null }; // range
    if (s.inParent) return { data: opts.replies ?? [], error: null }; // await
    return { data: [], error: null };
  }
  // comment_likes
  if (s.delete) return { error: opts.deleteError ?? null };
  if (s.insert) return { error: opts.insertLikeError ?? null };
  if (terminal === "maybeSingle") return { data: opts.existingLike ?? null };
  return { data: opts.likes ?? [] }; // .eq().in() awaited
}

function from(table: string) {
  const s: Record<string, boolean> = {};
  // biome-ignore lint/suspicious/noExplicitAny: a minimal chainable test double
  const b: any = {};
  b.select = vi.fn((_sel?: unknown, o?: { head?: boolean }) => {
    if (o?.head) s.head = true;
    return b;
  });
  b.eq = vi.fn(() => b);
  b.is = vi.fn((col: string, val: unknown) => {
    if (col === "parent_comment_id" && val === null) s.nullParent = true;
    return b;
  });
  b.in = vi.fn((col: string) => {
    if (col === "parent_comment_id") s.inParent = true;
    return b;
  });
  b.order = vi.fn(() => b);
  b.insert = vi.fn(() => {
    s.insert = true;
    return b;
  });
  b.upsert = vi.fn(() => {
    s.insert = true;
    return b;
  });
  b.delete = vi.fn(() => {
    s.delete = true;
    return b;
  });
  b.range = vi.fn(() => Promise.resolve(resolve(table, s, "range")));
  b.single = vi.fn(() => Promise.resolve(resolve(table, s, "single")));
  b.maybeSingle = vi.fn(() =>
    Promise.resolve(resolve(table, s, "maybeSingle")),
  );
  // biome-ignore lint/suspicious/noThenProperty: the supabase builder is awaitable; this mock must be thenable to simulate it
  b.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
    Promise.resolve(resolve(table, s, "await")).then(onF, onR);
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(from),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: opts.user ?? null } })),
    },
  })),
}));

import {
  countComments,
  listCommentPage,
  postComment,
  toggleCommentLike,
} from "./comments";

const USER = { id: "u1" };

beforeEach(() => {
  opts = {};
  vi.clearAllMocks();
});

describe("countComments", () => {
  it("returns the exact head count", async () => {
    opts = { count: 18 };
    expect(await countComments("w1")).toBe(18);
  });
  it("defaults to 0 when null", async () => {
    opts = { count: undefined };
    expect(await countComments("w1")).toBe(0);
  });
});

describe("listCommentPage", () => {
  it("nests replies under parents + flags my likes; hasMore when full page", async () => {
    opts = {
      user: USER,
      topLevel: [
        { id: "c1", parent_comment_id: null, body: "top", like_count: 2 },
      ],
      replies: [
        { id: "r1", parent_comment_id: "c1", body: "reply", like_count: 0 },
      ],
      likes: [{ comment_id: "c1" }],
    };
    const page = await listCommentPage("w1", { sort: "top", limit: 1 });
    expect(page.comments).toHaveLength(1);
    expect(page.comments[0].id).toBe("c1");
    expect(page.comments[0].likedByMe).toBe(true);
    expect(page.comments[0].replies).toHaveLength(1);
    expect(page.comments[0].replies[0].id).toBe("r1");
    expect(page.comments[0].replies[0].likedByMe).toBe(false);
    expect(page.hasMore).toBe(true); // 1 row === limit 1
  });

  it("empty thread → no comments, no more", async () => {
    opts = { user: USER, topLevel: [] };
    const page = await listCommentPage("w1");
    expect(page.comments).toEqual([]);
    expect(page.hasMore).toBe(false);
  });

  it("anon → likedByMe false everywhere (no likes query)", async () => {
    opts = {
      user: null,
      topLevel: [{ id: "c1", parent_comment_id: null, like_count: 5 }],
      replies: [],
    };
    const page = await listCommentPage("w1", { limit: 5 });
    expect(page.comments[0].likedByMe).toBe(false);
    expect(page.hasMore).toBe(false); // 1 row < limit 5
  });
});

describe("postComment", () => {
  it("requires authentication", async () => {
    opts = { user: null };
    expect(await postComment("w1", "hi")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });
  it("returns the enriched comment on success", async () => {
    opts = {
      user: USER,
      insertResult: { id: "c9", body: "hi", author: { handle: "me" } },
    };
    const res = await postComment("w1", "hi");
    expect(res).toEqual({
      ok: true,
      comment: {
        id: "c9",
        body: "hi",
        author: { handle: "me" },
        likedByMe: false,
        replies: [],
      },
    });
  });
  it("maps an insert error to db_error", async () => {
    opts = { user: USER, insertResult: null, insertError: { code: "23514" } };
    expect(await postComment("w1", "")).toEqual({
      ok: false,
      error: "db_error",
    });
  });
});

describe("toggleCommentLike", () => {
  it("requires authentication", async () => {
    opts = { user: null };
    expect(await toggleCommentLike("c1")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });
  it("likes when no existing row", async () => {
    opts = { user: USER, existingLike: null };
    expect(await toggleCommentLike("c1")).toEqual({ ok: true, liked: true });
  });
  it("un-likes when a row exists", async () => {
    opts = { user: USER, existingLike: { comment_id: "c1" } };
    expect(await toggleCommentLike("c1")).toEqual({ ok: true, liked: false });
  });
  it("maps a db error to db_error", async () => {
    opts = { user: USER, existingLike: null, insertLikeError: { code: "XX" } };
    expect(await toggleCommentLike("c1")).toEqual({
      ok: false,
      error: "db_error",
    });
  });
});
