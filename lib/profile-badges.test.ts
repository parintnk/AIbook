import { describe, expect, it } from "vitest";
import { deriveBadges } from "./profile-badges";

const stats = (
  over: Partial<Parameters<typeof deriveBadges>[0]["stats"]> = {},
) => ({
  published: 0,
  forksReceived: 0,
  workedPct: null,
  triedCount: 0,
  ...over,
});

describe("deriveBadges", () => {
  it("awards nothing for an empty creator", () => {
    expect(
      deriveBadges({ verified: false, stats: stats(), masterTools: [] }),
    ).toEqual([]);
  });

  it("picks the single highest fork milestone, not all of them", () => {
    const badges = deriveBadges({
      verified: false,
      stats: stats({ forksReceived: 120 }),
      masterTools: [],
    });
    const forkBadges = badges.filter((b) => b.id.startsWith("forks-"));
    expect(forkBadges).toHaveLength(1);
    expect(forkBadges[0].id).toBe("forks-100");
  });

  it("gates the worked-rate badge behind a tried-count floor", () => {
    const thin = deriveBadges({
      verified: false,
      stats: stats({ workedPct: 100, triedCount: 3 }),
      masterTools: [],
    });
    expect(thin.some((b) => b.id === "reliable")).toBe(false);

    const proven = deriveBadges({
      verified: false,
      stats: stats({ workedPct: 92, triedCount: 40 }),
      masterTools: [],
    });
    expect(proven.some((b) => b.id === "reliable")).toBe(true);
  });

  it("prefers Prolific over Recipe author and lists each mastered tool", () => {
    const badges = deriveBadges({
      verified: true,
      stats: stats({ published: 12 }),
      masterTools: ["Midjourney", "Claude"],
    });
    expect(badges.map((b) => b.id)).toContain("prolific");
    expect(badges.map((b) => b.id)).not.toContain("author");
    expect(badges.map((b) => b.id)).toContain("verified");
    expect(badges.filter((b) => b.id.startsWith("master-"))).toHaveLength(2);
  });
});
