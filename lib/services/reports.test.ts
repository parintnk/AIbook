import { beforeEach, describe, expect, it, vi } from "vitest";

// A chain-aware supabase mock: each `.from(table)` returns a builder that records its chain
// (head / insert / update / range / in) and resolves at the terminal (range / maybeSingle / await)
// to the per-test fixture for that query shape. Mirrors comments.test.ts.
type Opts = {
  user?: { id: string } | null;
  count?: number;
  insertError?: { code?: string } | null;
  reports?: unknown[];
  workflows?: unknown[];
  comments?: unknown[];
  updateData?: { id: string } | null;
  updateError?: { code?: string } | null;
};

let opts: Opts = {};

function resolve(table: string, s: Record<string, boolean>, terminal: string) {
  if (s.head) return { count: opts.count ?? 0 }; // isModeratorAnywhere head count
  if (s.insert) return { error: opts.insertError ?? null }; // createReport bare insert
  if (s.update && terminal === "maybeSingle")
    return { data: opts.updateData ?? null, error: opts.updateError ?? null }; // resolve/remove first update
  if (s.update) return { error: opts.updateError ?? null }; // remove's 2nd update (resolve reports)
  if (table === "reports" && s.range) return { data: opts.reports ?? [] }; // listOpenReports page
  if (table === "workflows") return { data: opts.workflows ?? [] }; // enrichment
  if (table === "comments") return { data: opts.comments ?? [] }; // enrichment
  return { data: [], error: null };
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
  b.in = vi.fn(() => {
    s.in = true;
    return b;
  });
  b.order = vi.fn(() => b);
  b.insert = vi.fn(() => {
    s.insert = true;
    return b;
  });
  b.update = vi.fn(() => {
    s.update = true;
    return b;
  });
  b.range = vi.fn(() => {
    s.range = true;
    return Promise.resolve(resolve(table, s, "range"));
  });
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
  createReport,
  isModeratorAnywhere,
  listOpenReports,
  removeReportedComment,
  resolveReport,
} from "./reports";

const USER = { id: "u1" };

beforeEach(() => {
  opts = {};
  vi.clearAllMocks();
});

describe("createReport", () => {
  it("requires authentication", async () => {
    opts = { user: null };
    expect(await createReport("workflow", "w1", "spam")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });
  it("succeeds on a clean insert (trims detail)", async () => {
    opts = { user: USER, insertError: null };
    expect(await createReport("workflow", "w1", "spam", "  bad  ")).toEqual({
      ok: true,
    });
  });
  it("maps a duplicate open report (23505) to already_reported", async () => {
    opts = { user: USER, insertError: { code: "23505" } };
    expect(await createReport("comment", "c1", "spam")).toEqual({
      ok: false,
      error: "already_reported",
    });
  });
  it("maps the trigger's invalid-target (P0001) to invalid_target", async () => {
    opts = { user: USER, insertError: { code: "P0001" } };
    expect(await createReport("workflow", "draft1", "other")).toEqual({
      ok: false,
      error: "invalid_target",
    });
  });
  it("maps any other db error to db_error", async () => {
    opts = { user: USER, insertError: { code: "XX000" } };
    expect(await createReport("workflow", "w1", "spam")).toEqual({
      ok: false,
      error: "db_error",
    });
  });
});

describe("isModeratorAnywhere", () => {
  it("false for anon", async () => {
    opts = { user: null };
    expect(await isModeratorAnywhere()).toBe(false);
  });
  it("true when the user moderates >= 1 profession", async () => {
    opts = { user: USER, count: 6 };
    expect(await isModeratorAnywhere()).toBe(true);
  });
  it("false when the user moderates none", async () => {
    opts = { user: USER, count: 0 };
    expect(await isModeratorAnywhere()).toBe(false);
  });
});

describe("listOpenReports", () => {
  it("returns [] for an empty queue", async () => {
    opts = { user: USER, reports: [] };
    // distinct limit so the cache key can't collide with the enrich test
    expect(await listOpenReports({ limit: 1 })).toEqual([]);
  });
  it("enriches workflow + comment targets with title/preview/profession", async () => {
    opts = {
      user: USER,
      reports: [
        {
          id: "r1",
          target_type: "workflow",
          target_id: "w1",
          reason: "spam",
          reporter: { handle: "a" },
        },
        {
          id: "r2",
          target_type: "comment",
          target_id: "c1",
          reason: "harassment",
          reporter: { handle: "b" },
        },
      ],
      workflows: [
        { id: "w1", title: "My WF", profession: { name: "Marketer" } },
      ],
      comments: [
        {
          id: "c1",
          body: "rude words here",
          workflow: { title: "Host WF", profession: { name: "Writer" } },
        },
      ],
    };
    const views = await listOpenReports({ limit: 5 });
    expect(views).toHaveLength(2);
    const wfView = views.find((v) => v.id === "r1");
    expect(wfView?.targetTitle).toBe("My WF");
    expect(wfView?.targetPreview).toBeNull();
    expect(wfView?.professionName).toBe("Marketer");
    const cmtView = views.find((v) => v.id === "r2");
    expect(cmtView?.targetTitle).toBe("Host WF");
    expect(cmtView?.targetPreview).toBe("rude words here");
    expect(cmtView?.professionName).toBe("Writer");
  });
});

describe("resolveReport", () => {
  it("requires authentication", async () => {
    opts = { user: null };
    expect(await resolveReport("r1", "dismissed")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });
  it("resolves when a row is updated", async () => {
    opts = { user: USER, updateData: { id: "r1" } };
    expect(await resolveReport("r1", "  dismissed  ")).toEqual({ ok: true });
  });
  it("returns not_found when RLS denies (no row updated)", async () => {
    opts = { user: USER, updateData: null };
    expect(await resolveReport("r1")).toEqual({
      ok: false,
      error: "not_found",
    });
  });
  it("maps an update error to db_error", async () => {
    opts = { user: USER, updateData: null, updateError: { code: "XX" } };
    expect(await resolveReport("r1")).toEqual({ ok: false, error: "db_error" });
  });
});

describe("removeReportedComment", () => {
  it("requires authentication", async () => {
    opts = { user: null };
    expect(await removeReportedComment("c1")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });
  it("hides the comment + resolves its open reports", async () => {
    opts = { user: USER, updateData: { id: "c1" }, updateError: null };
    expect(await removeReportedComment("c1", "Content removed")).toEqual({
      ok: true,
    });
  });
  it("returns not_found when the caller can't hide the comment (RLS)", async () => {
    opts = { user: USER, updateData: null };
    expect(await removeReportedComment("c1")).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});
