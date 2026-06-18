import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const rpc = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => {
      const b = {
        select: () => b,
        eq: () => b,
        maybeSingle,
      };
      return b;
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

import { checkAndConsumeQuota, getAiUsageToday } from "./rate-limit";

beforeEach(() => {
  getUser.mockReset();
  rpc.mockReset();
  maybeSingle.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("checkAndConsumeQuota", () => {
  it("allows under the cap and passes the feature's cap to the RPC", async () => {
    rpc.mockResolvedValue({
      data: [{ allowed: true, used: 1, quota: 5 }],
      error: null,
    });
    const res = await checkAndConsumeQuota({ feature: "skeleton" });
    expect(res).toEqual({ allowed: true, used: 1, limit: 5 });
    expect(rpc).toHaveBeenCalledWith("consume_ai_quota", {
      p_profile_id: "u1",
      p_feature: "skeleton",
      p_limit: 5,
    });
  });

  it("denies at the cap (not an error) and reports the count", async () => {
    rpc.mockResolvedValue({
      data: [{ allowed: false, used: 10, quota: 10 }],
      error: null,
    });
    const res = await checkAndConsumeQuota({ feature: "doctor" });
    expect(res).toEqual({ allowed: false, used: 10, limit: 10 });
  });

  it("treats a 0 cap (export/embed) as uncapped without calling the RPC", async () => {
    const res = await checkAndConsumeQuota({ feature: "export" });
    expect(res).toEqual({ allowed: true, used: 0, limit: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns not_authenticated without calling the RPC", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await checkAndConsumeQuota({ feature: "skeleton" });
    expect(res).toEqual({
      allowed: false,
      used: 0,
      limit: 0,
      error: "not_authenticated",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns db_error when the RPC errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await checkAndConsumeQuota({ feature: "skeleton" });
    expect(res).toEqual({
      allowed: false,
      used: 0,
      limit: 5,
      error: "db_error",
    });
  });
});

describe("getAiUsageToday", () => {
  it("reads the caller's own count via RLS (0 when none)", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    expect(await getAiUsageToday("skeleton")).toBe(0);
    maybeSingle.mockResolvedValue({ data: { count: 3 } });
    expect(await getAiUsageToday("skeleton")).toBe(3);
  });

  it("returns 0 when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getAiUsageToday("doctor")).toBe(0);
  });
});
