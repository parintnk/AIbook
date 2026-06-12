import { beforeEach, describe, expect, it, vi } from "vitest";

const orderMock = vi.fn();
const maybeSingleMock = vi.fn();
const getUserMock = vi.fn();
const rpcMock = vi.fn();

// One flexible builder covering the chains the service uses:
//   .select("*").order(...)            → listProfessions
//   .select("*").eq(...).maybeSingle() → getProfessionBySlug
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        order: orderMock,
        eq: () => ({ maybeSingle: maybeSingleMock }),
      }),
    }),
    auth: { getUser: getUserMock },
    rpc: rpcMock,
  })),
}));

import {
  getProfessionBySlug,
  isProfessionModerator,
  listProfessions,
} from "./professions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listProfessions", () => {
  it("returns the profession rows", async () => {
    orderMock.mockResolvedValueOnce({
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
    expect(await getProfessionBySlug("nope")).toBeNull();
  });
});

describe("isProfessionModerator", () => {
  it("returns false when unauthenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });
    expect(await isProfessionModerator("p1")).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns true when the RPC confirms moderator", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    rpcMock.mockResolvedValueOnce({ data: true, error: null });
    expect(await isProfessionModerator("p1")).toBe(true);
  });
});
