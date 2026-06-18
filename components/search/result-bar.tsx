import { Clock, GitFork, Sparkles } from "lucide-react";
import Link from "next/link";
import { buildSearchHref, type SearchSort } from "@/lib/search";
import styles from "./search.module.css";

const SORTS: Array<{ key: SearchSort; label: string; Icon: typeof Sparkles }> =
  [
    { key: "best", label: "Best match", Icon: Sparkles },
    { key: "forked", label: "Most forked", Icon: GitFork },
    { key: "new", label: "Newest", Icon: Clock },
  ];

/**
 * Result count (announced via `aria-live` on each new search, per FR2 / UX-DR10) + the sort segmented
 * control (mockup `.resbar`). Sort is URL state (`?sort=`) so it's shareable + RSC-driven.
 */
export function ResultBar({
  total,
  query,
  profession,
  tag,
  sort,
}: {
  total: number;
  query: string;
  profession: string | null;
  tag: string | null;
  sort: SearchSort;
}) {
  return (
    <div className={styles.resbar}>
      <div className={styles.rescount} aria-live="polite">
        <span className={styles.pulse} />
        <span>
          <b>{total}</b> {total === 1 ? "workflow matches" : "workflows match"}{" "}
          this goal
        </span>
      </div>
      <span className="sr-only" aria-live="polite">
        {total} {total === 1 ? "workflow" : "workflows"} found, ranked by
        semantic relevance.
      </span>
      <div className={styles.sortgroup}>
        {SORTS.map(({ key, label, Icon }) => (
          <Link
            key={key}
            href={buildSearchHref({ q: query, profession, tag, sort: key })}
            className={key === sort ? styles.sortOn : undefined}
            aria-current={key === sort ? "true" : undefined}
            scroll={false}
          >
            <Icon width={14} height={14} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
