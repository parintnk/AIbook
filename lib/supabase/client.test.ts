import { beforeAll, describe, expect, it } from "vitest";

describe("supabase browser client factory", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  });

  it("constructs a browser client without throwing", async () => {
    const { createClient } = await import("./client");
    expect(() => createClient()).not.toThrow();
    expect(createClient()).toHaveProperty("auth");
  });
});
