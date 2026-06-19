import Link from "next/link";
import { ONBOARDING_GOALS } from "@/lib/onboarding";
import { professionIcon } from "@/lib/profession-icons";
import styles from "./onboarding.module.css";

/**
 * Onboarding step 2 (Story 12.1) — the goal rows (the static `ONBOARDING_GOALS`; there is no goals
 * table). One tap advances to step 3 (`/welcome?profession={slug}&goal={slug}`). The chosen profession
 * is confirmed with a "change" chip linking back to step 1. Pure (URL-driven, no client state).
 */
export function GoalStep({
  professionSlug,
  professionName,
}: {
  professionSlug: string;
  professionName: string;
}) {
  const ProfIcon = professionIcon(professionSlug);
  return (
    <section className={styles.panel}>
      <div className={styles.phead}>
        <span className={styles.pno}>2</span>
        <div>
          <div className={styles.eyebrow}>Step 2 of 3</div>
          <h1 className={styles.h2}>What are you hoping to get done?</h1>
          <p className={styles.ps}>
            One goal for now — you can explore everything else later.
          </p>
          <div className="mt-2.5">
            <Link href="/welcome" className={styles.chip}>
              <ProfIcon width={13} height={13} aria-hidden="true" />
              {professionName} · change
            </Link>
          </div>
        </div>
      </div>
      <div className={styles.goals}>
        {ONBOARDING_GOALS.map((g) => {
          const Icon = g.icon;
          return (
            <Link
              key={g.slug}
              href={`/welcome?profession=${professionSlug}&goal=${g.slug}`}
              className={styles.goal}
            >
              <span className={styles.gi}>
                <Icon width={18} height={18} aria-hidden="true" />
              </span>
              <span className={styles.gtxt}>
                <span className={styles.gt}>{g.title}</span>
                <span className={styles.gd}>{g.description}</span>
              </span>
              <span className={styles.radio} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
