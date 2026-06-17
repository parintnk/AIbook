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
      delete: () => b,
      eq: () => b,
      in: () => b,
      order: () => b,
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
  listProfessionMods,
  listProfessionPins,
  listProfessions,
  parseHouseRules,
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
