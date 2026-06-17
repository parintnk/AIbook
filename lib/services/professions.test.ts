import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn();
const insertMock = vi.fn();
const queryMock = vi.fn(); // resolves an awaited chain (listProfessions / listProfessionMods)
const getUserMock = vi.fn();
const rpcMock = vi.fn();

// One self-chaining builder. Filter/shape methods return the builder; the terminals are
// `.maybeSingle()` (configurable), `.insert()` (configurable), and `await`-ing the chain
// itself (the builder is thenable → resolves `queryMock()`, the listProfessions /
// listProfessionMods pattern). `then` is only reached when a chain is awaited WITHOUT a
// `.maybeSingle()`/`.insert()` terminal.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const b = {
      select: () => b,
      insert: (...a: unknown[]) => insertMock(...a),
      update: () => b,
      delete: () => b,
      eq: () => b,
      in: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: () => maybeSingleMock(),
      // biome-ignore lint/suspicious/noThenProperty: the mock builder is intentionally thenable so an awaited query chain resolves.
      then: (resolve: (v: unknown) => unknown) => resolve(queryMock()),
    };
    return { from: () => b, auth: { getUser: getUserMock }, rpc: rpcMock };
  }),
}));

import {
  DEFAULT_HOUSE_RULES,
  getMyMembership,
  getProfessionBySlug,
  isProfessionModerator,
  joinProfession,
  leaveProfession,
  listPinnableWorkflows,
  listProfessionMods,
  listProfessionPins,
  listProfessions,
  parseHouseRules,
  pinWorkflow,
  reorderPins,
  unpinWorkflow,
  updateHouseRules,
} from "./professions";

const USER = { data: { user: { id: "u1" } } };
const NO_USER = { data: { user: null } };

beforeEach(() => {
  vi.clearAllMocks();
  queryMock.mockReturnValue({ data: [], error: null });
});

describe("listProfessions", () => {
  it("returns the profession rows", async () => {
    queryMock.mockReturnValueOnce({
      data: [{ id: "p1", slug: "x", name: "X" }],
      error: null,
    });
    const result = await listProfessions();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("X");
  });
});

describe("getProfessionBySlug", () => {
  it("returns null when not found", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await getProfessionBySlug("nope-xyz")).toBeNull();
  });
});

describe("isProfessionModerator", () => {
  it("returns false when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await isProfessionModerator("p1")).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("getMyMembership", () => {
  it("returns null when signed out (no query)", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await getMyMembership("p1")).toBeNull();
  });

  it("returns the role when a member", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: { role: "member" } });
    expect(await getMyMembership("p1")).toEqual({ role: "member" });
  });

  it("returns null when not a member", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: null });
    expect(await getMyMembership("p1")).toBeNull();
  });
});

describe("joinProfession", () => {
  it("requires authentication", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await joinProfession("p1")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("succeeds on insert", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    insertMock.mockResolvedValueOnce({ error: null });
    expect(await joinProfession("p1")).toEqual({ ok: true });
  });

  it("treats a duplicate (23505) as idempotent success", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    insertMock.mockResolvedValueOnce({ error: { code: "23505" } });
    expect(await joinProfession("p1")).toEqual({ ok: true });
  });

  it("maps other errors to db_error", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    insertMock.mockResolvedValueOnce({ error: { code: "23503" } });
    expect(await joinProfession("p1")).toEqual({
      ok: false,
      error: "db_error",
    });
  });
});

describe("leaveProfession", () => {
  it("requires authentication", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await leaveProfession("p1")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("succeeds when a row is deleted", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({
      data: { profile_id: "u1" },
      error: null,
    });
    expect(await leaveProfession("p1")).toEqual({ ok: true });
  });

  it("returns not_found on a zero-row delete (e.g. a moderator can't self-leave)", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await leaveProfession("p1")).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});

describe("listProfessionMods", () => {
  it("maps rows to ProfessionMod (flattening the profile embed)", async () => {
    queryMock.mockReturnValueOnce({
      data: [
        {
          profile_id: "u1",
          role: "moderator",
          profile: {
            handle: "maya",
            display_name: "Maya",
            avatar_url: null,
          },
        },
      ],
      error: null,
    });
    const mods = await listProfessionMods("p1");
    expect(mods).toEqual([
      {
        profileId: "u1",
        role: "moderator",
        handle: "maya",
        displayName: "Maya",
        avatarUrl: null,
      },
    ]);
  });
});

describe("listProfessionPins", () => {
  it("maps published pinned workflows to {id,title} in position order", async () => {
    queryMock.mockReturnValueOnce({
      data: [
        { workflow: { id: "w1", title: "Pinned A", status: "published" } },
        { workflow: { id: "w2", title: "Pinned B", status: "published" } },
      ],
      error: null,
    });
    expect(await listProfessionPins("p1")).toEqual([
      { id: "w1", title: "Pinned A" },
      { id: "w2", title: "Pinned B" },
    ]);
  });

  it("returns [] when the profession has no pins", async () => {
    queryMock.mockReturnValueOnce({ data: [], error: null });
    expect(await listProfessionPins("p1")).toEqual([]);
  });

  it("drops a row whose workflow embed is null (defensive — the inner-join published filter)", async () => {
    queryMock.mockReturnValueOnce({
      data: [
        { workflow: null },
        { workflow: { id: "w3", title: "C", status: "published" } },
      ],
      error: null,
    });
    expect(await listProfessionPins("p1")).toEqual([{ id: "w3", title: "C" }]);
  });

  it("drops a non-published embed in JS too (7.3 defense-in-depth if `!inner` is ever dropped)", async () => {
    queryMock.mockReturnValueOnce({
      data: [
        { workflow: { id: "w4", title: "Draft", status: "draft" } },
        { workflow: { id: "w5", title: "Live", status: "published" } },
      ],
      error: null,
    });
    expect(await listProfessionPins("p1")).toEqual([
      { id: "w5", title: "Live" },
    ]);
  });
});

describe("parseHouseRules", () => {
  it("returns the profession's own rules when well-formed", () => {
    const rules = [
      { title: "Ship the stack.", body: "Name every tool." },
      { title: "Show real output.", body: "Attach a sample." },
    ];
    expect(parseHouseRules(rules)).toEqual(rules);
  });

  it("falls back to the 3 universal defaults when rules is empty", () => {
    expect(parseHouseRules([])).toEqual(DEFAULT_HOUSE_RULES);
    expect(DEFAULT_HOUSE_RULES).toHaveLength(3);
  });

  it("falls back when rules is null or malformed (missing body)", () => {
    expect(parseHouseRules(null)).toEqual(DEFAULT_HOUSE_RULES);
    expect(parseHouseRules("nope")).toEqual(DEFAULT_HOUSE_RULES);
    expect(parseHouseRules([{ title: "x" }])).toEqual(DEFAULT_HOUSE_RULES);
  });
});

// ── Story 7.3 — moderator mutations ──────────────────────────────────────────

describe("pinWorkflow", () => {
  it("inserts at the next position (max+1) and succeeds", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { position: 1 },
      error: null,
    });
    insertMock.mockReturnValueOnce({ error: null });
    expect(await pinWorkflow("p1", "w1")).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({
      profession_id: "p1",
      workflow_id: "w1",
      position: 2,
    });
  });

  it("uses position 0 when the profession has no pins yet", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    insertMock.mockReturnValueOnce({ error: null });
    await pinWorkflow("p1", "w1");
    expect(insertMock).toHaveBeenCalledWith({
      profession_id: "p1",
      workflow_id: "w1",
      position: 0,
    });
  });

  it("treats a duplicate pin (23505) as an idempotent success", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { position: 0 },
      error: null,
    });
    insertMock.mockReturnValueOnce({ error: { code: "23505" } });
    expect(await pinWorkflow("p1", "w1")).toEqual({ ok: true });
  });

  it("returns db_error on a trigger rejection / other insert error", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    insertMock.mockReturnValueOnce({ error: { code: "P0001" } });
    expect(await pinWorkflow("p1", "w1")).toEqual({
      ok: false,
      error: "db_error",
    });
  });
});

describe("unpinWorkflow", () => {
  it("returns ok when a row was deleted", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: "pin1" },
      error: null,
    });
    expect(await unpinWorkflow("p1", "w1")).toEqual({ ok: true });
  });

  it("returns not_found when the delete matched zero rows (RLS / not pinned)", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await unpinWorkflow("p1", "w1")).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});

describe("reorderPins", () => {
  it("succeeds when every position update succeeds", async () => {
    queryMock.mockReturnValue({ data: null, error: null });
    expect(await reorderPins("p1", ["w1", "w2", "w3"])).toEqual({ ok: true });
  });

  it("returns db_error if a position update fails", async () => {
    queryMock.mockReturnValueOnce({ data: null, error: { code: "P0001" } });
    expect(await reorderPins("p1", ["w1", "w2"])).toEqual({
      ok: false,
      error: "db_error",
    });
  });
});

describe("updateHouseRules", () => {
  it("persists well-formed rules", async () => {
    queryMock.mockReturnValueOnce({ data: null, error: null });
    expect(
      await updateHouseRules("p1", [
        { title: "Ship the stack.", body: "Name every tool." },
      ]),
    ).toEqual({ ok: true });
  });

  it("rejects blank-after-trim rules WITHOUT writing (7.3 validation)", async () => {
    expect(await updateHouseRules("p1", [{ title: "   ", body: "x" }])).toEqual(
      {
        ok: false,
        error: "db_error",
      },
    );
  });

  it("rejects an empty rules list", async () => {
    expect(await updateHouseRules("p1", [])).toEqual({
      ok: false,
      error: "db_error",
    });
  });
});

describe("listPinnableWorkflows", () => {
  it("returns the profession's published workflows as {id,title}", async () => {
    queryMock.mockReturnValueOnce({
      data: [
        { id: "w1", title: "Alpha" },
        { id: "w2", title: "Beta" },
      ],
      error: null,
    });
    expect(await listPinnableWorkflows("p1")).toEqual([
      { id: "w1", title: "Alpha" },
      { id: "w2", title: "Beta" },
    ]);
  });
});
