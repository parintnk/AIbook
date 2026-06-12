import { describe, expect, it } from "vitest";
import { aiStackItemSchema, handleSchema, profileFormSchema } from "./profile";

describe("handleSchema", () => {
  it("accepts 3–30 lowercase / digit / underscore handles", () => {
    expect(handleSchema.safeParse("abc").success).toBe(true);
    expect(handleSchema.safeParse("parin_tnk_13").success).toBe(true);
  });

  it("rejects uppercase, symbols, too short, too long", () => {
    expect(handleSchema.safeParse("AB").success).toBe(false); // too short + caps
    expect(handleSchema.safeParse("ab").success).toBe(false); // too short
    expect(handleSchema.safeParse("Parin").success).toBe(false); // uppercase
    expect(handleSchema.safeParse("has space").success).toBe(false);
    expect(handleSchema.safeParse("dot.dot").success).toBe(false);
    expect(handleSchema.safeParse("a".repeat(31)).success).toBe(false);
  });
});

describe("aiStackItemSchema", () => {
  it("accepts a valid item (numbers; the form supplies valueAsNumber)", () => {
    const parsed = aiStackItemSchema.safeParse({
      tool_name: "Midjourney",
      skill_level: 4,
      sort_order: 0,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.skill_level).toBe(4);
  });

  it("rejects non-numeric skill levels (no string coercion)", () => {
    expect(
      aiStackItemSchema.safeParse({
        tool_name: "X",
        skill_level: "4",
        sort_order: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects out-of-range skill levels and empty tool names", () => {
    expect(
      aiStackItemSchema.safeParse({
        tool_name: "X",
        skill_level: 6,
        sort_order: 0,
      }).success,
    ).toBe(false);
    expect(
      aiStackItemSchema.safeParse({
        tool_name: "",
        skill_level: 3,
        sort_order: 0,
      }).success,
    ).toBe(false);
  });
});

describe("profileFormSchema", () => {
  const base = {
    handle: "tester",
    display_name: "Tester",
    bio: "hi",
    avatar_url: "",
    hire_me_url: "",
    hire_me_visible: false,
    ai_stack: [],
  };

  it("accepts a valid profile with empty optional URLs", () => {
    expect(profileFormSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a valid avatar URL but rejects a malformed one", () => {
    expect(
      profileFormSchema.safeParse({
        ...base,
        avatar_url: "https://x.com/a.png",
      }).success,
    ).toBe(true);
    expect(
      profileFormSchema.safeParse({ ...base, avatar_url: "not-a-url" }).success,
    ).toBe(false);
  });

  it("rejects a bio over 280 chars", () => {
    expect(
      profileFormSchema.safeParse({ ...base, bio: "x".repeat(281) }).success,
    ).toBe(false);
  });
});
