import { Award, BadgeCheck, GitFork, ShieldCheck, Star } from "lucide-react";
import type { ProfileBadge } from "@/lib/profile-badges";
import styles from "./profile.module.css";

const TONE_CLASS: Record<ProfileBadge["tone"], string> = {
  violet: styles.bViolet,
  amber: styles.bAmber,
  emerald: styles.bEmerald,
  gold: styles.bGold,
};

function BadgeIcon({ id }: { id: string }) {
  const props = { width: 13, height: 13, "aria-hidden": true } as const;
  if (id === "verified") return <ShieldCheck {...props} />;
  if (id.startsWith("forks-")) return <GitFork {...props} />;
  if (id === "reliable") return <BadgeCheck {...props} />;
  if (id.startsWith("master-")) return <Star {...props} />;
  return <Award {...props} />;
}

/**
 * The earned-badges tile (Story 9.x) — auto-awarded pills derived from real stats (see
 * `deriveBadges`). Ported from the mockup's `.badge-pill`; tones route through the app accent
 * (violet) plus fixed semantic amber/emerald/gold for the milestone/reliability/verified pills.
 */
export function ProfileBadges({ badges }: { badges: ProfileBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className={`${styles.tile} ${styles.badgesTile}`}>
      <div className={styles.tileH}>
        <span className={styles.tileGlyph}>
          <Award width={18} height={18} aria-hidden="true" />
        </span>
        <h2 className={styles.tileTitle}>Badges</h2>
        <span className={styles.tileNote}>Auto-awarded</span>
      </div>
      <div className={styles.badges}>
        {badges.map((b) => (
          <span
            key={b.id}
            className={`${styles.badgePill} ${TONE_CLASS[b.tone]}`}
          >
            <span className={styles.bic}>
              <BadgeIcon id={b.id} />
            </span>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
