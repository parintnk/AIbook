import { describe, expect, it } from "vitest";
import { formatVerifiedAge } from "./verified-age";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("formatVerifiedAge", () => {
  it("formats a recent date as neutral (not stale)", () => {
    const r = formatVerifiedAge(null, daysAgo(14), NOW);
    expect(r).not.toBeNull();
    expect(r?.label).toMatch(/last verified .* ago/i);
    expect(r?.isStale).toBe(false);
  });

  it("marks a date older than 90 days as stale", () => {
    expect(formatVerifiedAge(null, daysAgo(120), NOW)?.isStale).toBe(true);
  });

  it("treats exactly 90 days as NOT stale (strictly > 90), 91 as stale", () => {
    expect(formatVerifiedAge(null, daysAgo(90), NOW)?.isStale).toBe(false);
    expect(formatVerifiedAge(null, daysAgo(91), NOW)?.isStale).toBe(true);
  });

  it("prefers last_verified_at over published_at", () => {
    // 5-day last_verified beats a 200-day published → not stale.
    expect(formatVerifiedAge(daysAgo(5), daysAgo(200), NOW)?.isStale).toBe(
      false,
    );
  });

  it("falls back to published_at when last_verified_at is null", () => {
    expect(formatVerifiedAge(null, daysAgo(200), NOW)?.isStale).toBe(true);
  });

  it("returns null when both dates are null", () => {
    expect(formatVerifiedAge(null, null, NOW)).toBeNull();
  });

  it("handles a future date as not stale", () => {
    const future = new Date(NOW.getTime() + 86_400_000).toISOString();
    const r = formatVerifiedAge(null, future, NOW);
    expect(r?.isStale).toBe(false);
    expect(r?.label).toMatch(/last verified/i);
  });

  it("buckets the relative label into natural units (pins the wording)", () => {
    expect(formatVerifiedAge(null, daysAgo(2), NOW)?.label).toBe(
      "Last verified 2 days ago",
    );
    expect(formatVerifiedAge(null, daysAgo(14), NOW)?.label).toBe(
      "Last verified 2 weeks ago",
    );
    expect(formatVerifiedAge(null, daysAgo(400), NOW)?.label).toBe(
      "Last verified 1 year ago",
    );
  });
});
