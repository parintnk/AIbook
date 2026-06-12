import { describe, expect, it } from "vitest";
import { sanitizeNext } from "./redirect";

describe("sanitizeNext", () => {
  it("falls back to / for empty/nullish input", () => {
    expect(sanitizeNext(undefined)).toBe("/");
    expect(sanitizeNext(null)).toBe("/");
    expect(sanitizeNext("")).toBe("/");
  });

  it("allows same-origin relative paths", () => {
    expect(sanitizeNext("/account")).toBe("/account");
    expect(sanitizeNext("/workflows/new")).toBe("/workflows/new");
    expect(sanitizeNext("/explore?tab=top")).toBe("/explore?tab=top");
  });

  it("rejects absolute / external URLs", () => {
    expect(sanitizeNext("https://evil.com")).toBe("/");
    expect(sanitizeNext("http://evil.com/account")).toBe("/");
  });

  it("rejects protocol-relative and backslash tricks", () => {
    expect(sanitizeNext("//evil.com")).toBe("/");
    expect(sanitizeNext("/\\evil.com")).toBe("/");
    expect(sanitizeNext("/foo\\bar")).toBe("/");
  });
});
