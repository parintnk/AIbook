import {
  Code,
  type LucideIcon,
  Megaphone,
  Palette,
  PenLine,
  Sparkles,
  Video,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import styles from "@/components/workflows/explore.module.css";

// The professions table has no icon column → map the seeded slugs to a lucide glyph
// (matches the mockup's per-chip icons). Unknown slug → Sparkles.
const ICONS: Record<string, LucideIcon> = {
  "graphic-designer": Palette,
  "web-developer": Code,
  "video-creator": Video,
  "content-writer": PenLine,
  marketer: Megaphone,
  "ai-automation": Workflow,
};

/**
 * Profession filter chips (FR3): "All" + each profession. Selecting a chip filters the
 * Trending feed via the shareable `?profession={slug}` searchParam (RSC navigation). The
 * active chip reflects the current filter ("All" when none).
 */
export function ProfessionChips({
  professions,
  active,
}: {
  professions: Array<{ slug: string; name: string }>;
  active: string | null;
}) {
  return (
    <nav className={styles.chips} aria-label="Filter by profession">
      <Link
        href="/explore"
        className={active ? styles.chip : `${styles.chip} ${styles.chipOn}`}
        aria-current={active ? undefined : "true"}
      >
        All
      </Link>
      {professions.map((p) => {
        const Icon = ICONS[p.slug] ?? Sparkles;
        const on = active === p.slug;
        return (
          <Link
            key={p.slug}
            href={`/explore?profession=${p.slug}`}
            className={on ? `${styles.chip} ${styles.chipOn}` : styles.chip}
            aria-current={on ? "true" : undefined}
          >
            <span className={styles.ic}>
              <Icon width={14} height={14} aria-hidden="true" />
            </span>
            {p.name}
          </Link>
        );
      })}
    </nav>
  );
}
