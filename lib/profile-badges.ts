import type { AuthorPublishedStats } from "@/lib/services/workflows";

/**
 * Auto-awarded profile badges (Story 9.x) — DERIVED from real data the profile already loads
 * (verified status, published/forks/worked stats, the AI stack). No badge table, no manual grants:
 * a badge appears the moment the data crosses its threshold. The mockup's hand-written badges
 * ("Trending in X", "Helped 100 newbies") need signals we don't track, so they're not faked.
 */

export type BadgeTone = "violet" | "amber" | "emerald" | "gold";
export type ProfileBadge = { id: string; label: string; tone: BadgeTone };

type Input = {
  verified: boolean;
  stats: AuthorPublishedStats;
  masterTools: string[]; // tool_name of every self-rated 5/5 AI-stack item
};

/** Highest fork-milestone that `n` clears, or null. */
function forkMilestone(n: number): ProfileBadge | null {
  if (n >= 100) return { id: "forks-100", label: "100+ forks", tone: "amber" };
  if (n >= 50) return { id: "forks-50", label: "50+ forks", tone: "amber" };
  if (n >= 10) return { id: "forks-10", label: "10+ forks", tone: "amber" };
  return null;
}

export function deriveBadges({
  verified,
  stats,
  masterTools,
}: Input): ProfileBadge[] {
  const badges: ProfileBadge[] = [];

  if (verified)
    badges.push({ id: "verified", label: "Verified pro", tone: "gold" });

  if (stats.published >= 10)
    badges.push({ id: "prolific", label: "Prolific creator", tone: "violet" });
  else if (stats.published >= 1)
    badges.push({ id: "author", label: "Recipe author", tone: "violet" });

  const forks = forkMilestone(stats.forksReceived);
  if (forks) badges.push(forks);

  if (
    stats.workedPct !== null &&
    stats.workedPct >= 90 &&
    stats.triedCount >= 10
  )
    badges.push({
      id: "reliable",
      label: "Reliable recipes",
      tone: "emerald",
    });

  for (const tool of masterTools)
    badges.push({
      id: `master-${tool}`,
      label: `Master of ${tool}`,
      tone: "violet",
    });

  return badges;
}
