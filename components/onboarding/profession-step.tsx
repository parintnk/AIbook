import Link from "next/link";
import { professionIcon } from "@/lib/profession-icons";
import styles from "./onboarding.module.css";

/**
 * Onboarding step 1 (Story 12.1) — the profession grid. Renders the REAL seeded professions
 * (`listProfessions()`, NOT the mockup's illustrative labels — the 6.1 lesson) as `<Link>` cards; one
 * tap advances to step 2 (`/welcome?profession={slug}`). Pure (no client state) — the URL is the flow.
 */
const PROFESSION_META: Record<string, string> = {
  "graphic-designer": "Logos · brand kits · decks",
  "video-creator": "Scripts · edits · thumbnails",
  "web-developer": "Sites · apps · automations",
  "content-writer": "Copy · articles · SEO",
  marketer: "Campaigns · ads · funnels",
  "ai-automation": "Agents · pipelines · ops",
};

export function ProfessionStep({
  professions,
}: {
  professions: Array<{ slug: string; name: string }>;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.phead}>
        <span className={styles.pno}>1</span>
        <div>
          <div className={styles.eyebrow}>Step 1 of 3</div>
          <h1 className={styles.h2}>What kind of work do you do?</h1>
          <p className={styles.ps}>
            Pick the kitchen you cook in — we'll stock the shelves with recipes
            that fit.
          </p>
        </div>
      </div>
      <div className={styles.pgrid}>
        {professions.map((p) => {
          const Icon = professionIcon(p.slug);
          return (
            <Link
              key={p.slug}
              href={`/welcome?profession=${p.slug}`}
              className={styles.pcard}
            >
              <span className={styles.pic}>
                <Icon width={20} height={20} aria-hidden="true" />
              </span>
              <span className={styles.pname}>{p.name}</span>
              {PROFESSION_META[p.slug] ? (
                <span className={styles.pmeta}>{PROFESSION_META[p.slug]}</span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
