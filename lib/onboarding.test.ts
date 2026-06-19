import { describe, expect, it } from "vitest";
import { goalBySlug, ONBOARDING_GOALS } from "./onboarding";

describe("onboarding goals (Story 12.1)", () => {
  it("exposes 4 universal goals, each with the required fields", () => {
    expect(ONBOARDING_GOALS).toHaveLength(4);
    for (const g of ONBOARDING_GOALS) {
      expect(g.slug).toBeTruthy();
      expect(g.title).toBeTruthy();
      expect(g.description).toBeTruthy();
      expect(g.icon).toBeTruthy();
    }
    // slugs are unique
    const slugs = new Set(ONBOARDING_GOALS.map((g) => g.slug));
    expect(slugs.size).toBe(4);
  });

  it("goalBySlug resolves a known slug + returns null otherwise", () => {
    expect(goalBySlug("deliver-faster")?.title).toBe(
      "Deliver client work faster",
    );
    expect(goalBySlug("nope")).toBeNull();
    expect(goalBySlug(null)).toBeNull();
    expect(goalBySlug(undefined)).toBeNull();
  });
});
