import { beforeEach, describe, expect, it, vi } from "vitest";

const listProfessions = vi.fn();
vi.mock("@/lib/services/professions", () => ({
  listProfessions: () => listProfessions(),
}));

import { persistPrimaryProfession } from "./onboarding-persist";

type Calls = {
  update?: unknown;
  eq?: [string, unknown];
  is?: [string, unknown];
};

function stub({
  user = { id: "u1" } as { id: string } | null,
  isResult = Promise.resolve({ error: null }),
}: {
  user?: { id: string } | null;
  isResult?: Promise<unknown>;
} = {}) {
  const calls: Calls = {};
  const chain = {
    update(payload: unknown) {
      calls.update = payload;
      return chain;
    },
    eq(col: string, val: unknown) {
      calls.eq = [col, val];
      return chain;
    },
    is(col: string, val: unknown) {
      calls.is = [col, val];
      return isResult;
    },
  };
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => chain,
  };
  return { client, calls };
}

describe("persistPrimaryProfession (Story 12.2)", () => {
  beforeEach(() => {
    listProfessions.mockReset();
    listProfessions.mockResolvedValue([
      { id: "p1", slug: "graphic-designer", name: "Graphic Designer" },
    ]);
  });

  it("writes the resolved profession id, scoped to the user + first-set-wins (.is null)", async () => {
    const { client, calls } = stub();
    await persistPrimaryProfession(
      client as never,
      "/explore?profession=graphic-designer",
    );
    expect(calls.update).toEqual({ primary_profession_id: "p1" });
    expect(calls.eq).toEqual(["id", "u1"]);
    expect(calls.is).toEqual(["primary_profession_id", null]);
  });

  it("no-ops when `next` carries no profession", async () => {
    const { client, calls } = stub();
    await persistPrimaryProfession(client as never, "/");
    expect(calls.update).toBeUndefined();
  });

  it("no-ops on an unknown profession slug", async () => {
    const { client, calls } = stub();
    await persistPrimaryProfession(client as never, "/explore?profession=nope");
    expect(calls.update).toBeUndefined();
  });

  it("no-ops when there is no signed-in user", async () => {
    const { client, calls } = stub({ user: null });
    await persistPrimaryProfession(
      client as never,
      "/explore?profession=graphic-designer",
    );
    expect(calls.update).toBeUndefined();
  });

  it("swallows a failing update (best-effort — never throws into the login flow)", async () => {
    const { client } = stub({ isResult: Promise.reject(new Error("boom")) });
    await expect(
      persistPrimaryProfession(
        client as never,
        "/explore?profession=graphic-designer",
      ),
    ).resolves.toBeUndefined();
  });
});
