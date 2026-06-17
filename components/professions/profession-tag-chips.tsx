import Link from "next/link";
import { communityHref } from "@/lib/community-href";
import type { Tag, WorkflowSort } from "@/lib/explore";
import styles from "./community.module.css";

/**
 * Tag-filter chip row (Story 6.2 / AC1 "filterable by tag"). "All" + each tag present on
 * this profession's published workflows. Selecting a chip filters the feed via the shareable
 * `?tag={slug}` searchParam (composing with `?sort=`); "All" clears it. Renders nothing when
 * the profession has no tagged published work.
 */
export function ProfessionTagChips({
  slug,
  tags,
  sort,
  activeTag,
}: {
  slug: string;
  tags: Tag[];
  sort: WorkflowSort;
  activeTag: string | null;
}) {
  if (tags.length === 0) return null;
  return (
    <nav className={styles.tagchips} aria-label="Filter by tag">
      <Link
        href={communityHref(slug, sort, null)}
        className={
          activeTag ? styles.tagchip : `${styles.tagchip} ${styles.tagchipOn}`
        }
        aria-current={activeTag ? undefined : "true"}
      >
        All
      </Link>
      {tags.map((t) => {
        const on = activeTag === t.slug;
        return (
          <Link
            key={t.id}
            href={communityHref(slug, sort, t.slug)}
            className={
              on ? `${styles.tagchip} ${styles.tagchipOn}` : styles.tagchip
            }
            aria-current={on ? "true" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
