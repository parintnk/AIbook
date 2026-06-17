import { describe, expect, it } from "vitest";
import { communityHref } from "./community-href";

describe("communityHref", () => {
  it("keeps the default `trending` sort + no tag out of the URL (clean canonical)", () => {
    expect(communityHref("graphic-designer", "trending", null)).toBe(
      "/communities/graphic-designer",
    );
  });

  it("encodes the `new` sort", () => {
    expect(communityHref("graphic-designer", "new", null)).toBe(
      "/communities/graphic-designer?sort=new",
    );
  });

  it("encodes the `top` sort (Story 7.1)", () => {
    expect(communityHref("graphic-designer", "top", null)).toBe(
      "/communities/graphic-designer?sort=top",
    );
  });

  it("preserves the active tag alongside the sort", () => {
    expect(communityHref("graphic-designer", "top", "logos")).toBe(
      "/communities/graphic-designer?tag=logos&sort=top",
    );
  });
});
