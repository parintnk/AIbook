import { describe, expect, it } from "vitest";
import { buildSearchHref, highlightTerms, parseSearchSort } from "./search";

describe("parseSearchSort", () => {
  it("maps known sorts and defaults the rest to best", () => {
    expect(parseSearchSort("forked")).toBe("forked");
    expect(parseSearchSort("new")).toBe("new");
    expect(parseSearchSort("best")).toBe("best");
    expect(parseSearchSort("garbage")).toBe("best");
    expect(parseSearchSort(undefined)).toBe("best");
  });
});

describe("buildSearchHref", () => {
  it("encodes the query + only the active filters (best sort omitted)", () => {
    expect(buildSearchHref({ q: "logo kit" })).toBe("/search?q=logo+kit");
    expect(
      buildSearchHref({
        q: "a",
        profession: "graphic-designer",
        tag: "logo",
        sort: "forked",
      }),
    ).toBe("/search?q=a&profession=graphic-designer&tag=logo&sort=forked");
    expect(buildSearchHref({ q: "a", sort: "best" })).toBe("/search?q=a");
  });
});

describe("highlightTerms", () => {
  it("wraps matching terms (case-insensitive) and preserves the text", () => {
    const segs = highlightTerms("Coffee shop brand kit", "brand coffee");
    expect(segs.filter((s) => s.mark).map((s) => s.t.toLowerCase())).toEqual([
      "coffee",
      "brand",
    ]);
    expect(segs.map((s) => s.t).join("")).toBe("Coffee shop brand kit");
  });

  it("returns the whole text unmarked when no term is ≥2 chars", () => {
    expect(highlightTerms("hello", "a")).toEqual([{ t: "hello", mark: false }]);
  });
});
