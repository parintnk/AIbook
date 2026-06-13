import { describe, expect, it } from "vitest";
import { isActivePath, PRIMARY_NAV_LINKS } from "./nav";

describe("isActivePath", () => {
  it("matches the exact path", () => {
    expect(isActivePath("/explore", "/explore")).toBe(true);
  });

  it("matches sub-routes", () => {
    expect(isActivePath("/boards/123", "/boards")).toBe(true);
  });

  it("does not match unrelated or prefix-only paths", () => {
    expect(isActivePath("/explore", "/communities")).toBe(false);
    // "/exploring" must not activate "/explore" — guarded by the trailing slash
    expect(isActivePath("/exploring", "/explore")).toBe(false);
  });

  it("exact mode ignores sub-routes (for roots like / and /me)", () => {
    expect(isActivePath("/", "/", true)).toBe(true);
    expect(isActivePath("/explore", "/", true)).toBe(false);
    expect(isActivePath("/me/anything", "/me", true)).toBe(false);
  });
});

describe("PRIMARY_NAV_LINKS", () => {
  it("lists the four primary destinations in order", () => {
    expect(PRIMARY_NAV_LINKS.map((link) => link.href)).toEqual([
      "/explore",
      "/communities",
      "/forked",
      "/boards",
    ]);
  });
});
