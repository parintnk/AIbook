import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  THUMB_WASHES,
  thumbKit,
  thumbLabel,
  thumbWash,
  workedPct,
} from "./explore";

describe("workedPct", () => {
  it("returns null when there are no tried votes", () => {
    expect(workedPct(0, 0)).toBeNull();
    expect(workedPct(0.92, 0)).toBeNull();
  });

  it("rounds a 0–1 ratio to a whole percentage (mirrors the lineage panel)", () => {
    expect(workedPct(0.92, 12)).toBe(92);
    expect(workedPct(0.875, 8)).toBe(88); // rounds half up
    expect(workedPct(1, 5)).toBe(100);
  });
});

describe("thumbWash", () => {
  it("is deterministic and always a known wash", () => {
    const a = thumbWash("00000000-0000-0000-0000-0000000000aa");
    expect(a).toBe(thumbWash("00000000-0000-0000-0000-0000000000aa"));
    expect(THUMB_WASHES).toContain(a);
  });

  it("spreads different ids across washes", () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, i) => thumbWash(`id-${i}`)),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("thumbKit", () => {
  it("maps each output kind to its decoration", () => {
    expect(thumbKit("image")).toBe("logo");
    expect(thumbKit("video")).toBe("video");
    expect(thumbKit("file")).toBe("sheet");
    expect(thumbKit("text")).toBe("doc");
    expect(thumbKit(null)).toBe("doc");
  });
});

describe("thumbLabel", () => {
  it("uses the kind, falling back to 'recipe'", () => {
    expect(thumbLabel("image")).toBe("image");
    expect(thumbLabel(null)).toBe("recipe");
  });
});

describe("PAGE_SIZE", () => {
  it("is a sensible feed page size", () => {
    expect(PAGE_SIZE).toBeGreaterThanOrEqual(6);
  });
});
