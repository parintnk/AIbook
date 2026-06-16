import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn();
const upsertMock = vi.fn();
const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const b = {
      select: () => b,
      eq: () => b,
      upsert: upsertMock,
      maybeSingle: maybeSingleMock,
    };
    return { from: () => b, auth: { getUser: getUserMock } };
  }),
}));

import { castOutcomeVote, getMyOutcomeVote } from "./outcome-votes";

const USER = { data: { user: { id: "u1" } } };
const NO_USER = { data: { user: null } };

beforeEach(() => vi.clearAllMocks());

describe("getMyOutcomeVote", () => {
  it("returns null when unauthenticated (no query)", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await getMyOutcomeVote("w1")).toBeNull();
    expect(maybeSingleMock).not.toHaveBeenCalled();
  });

  it("returns the caller's vote row", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: "v1", workflow_id: "w1", voter_id: "u1", verdict: "worked" },
      error: null,
    });
    expect((await getMyOutcomeVote("w1"))?.verdict).toBe("worked");
  });

  it("returns null when the caller has no vote", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await getMyOutcomeVote("w1")).toBeNull();
  });
});

describe("castOutcomeVote", () => {
  it("requires authentication (no upsert)", async () => {
    getUserMock.mockResolvedValueOnce(NO_USER);
    expect(await castOutcomeVote("w1", "worked")).toEqual({
      ok: false,
      error: "not_authenticated",
    });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("upserts the vote and returns ok", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    upsertMock.mockResolvedValueOnce({ error: null });
    expect(await castOutcomeVote("w1", "tweaked", "needed a tweak")).toEqual({
      ok: true,
    });
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("maps a db error to db_error", async () => {
    getUserMock.mockResolvedValueOnce(USER);
    upsertMock.mockResolvedValueOnce({ error: { code: "XX000" } });
    expect(await castOutcomeVote("w1", "failed")).toEqual({
      ok: false,
      error: "db_error",
    });
  });
});
