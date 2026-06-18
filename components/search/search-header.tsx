import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { buildSearchHref, type SearchSort } from "@/lib/search";
import styles from "./search.module.css";

/**
 * The results header (mockup `.shead`): eyebrow + the gradient query line ("Workflows to {query}") +
 * subline + the profession/tag filter chips. Chips are Links that toggle `?profession=`/`?tag=` in
 * the URL (the shareable RSC state, DR-5); an active chip removes itself ("All" / un-tag). Tags are
 * derived from the current result set (so they're relevant) — see the page.
 */
export function SearchHeader({
  query,
  professions,
  activeProfession,
  tags,
  activeTag,
  sort,
}: {
  query: string;
  professions: Array<{ slug: string; name: string }>;
  activeProfession: string | null;
  tags: Array<{ slug: string; label: string }>;
  activeTag: string | null;
  sort: SearchSort;
}) {
  return (
    <div className={styles.shead}>
      <span className={styles.eyebrow}>
        <Sparkles width={13} height={13} aria-hidden="true" />
        Semantic results · ranked by relevance
      </span>
      <div className={styles.queryline}>
        <span className={styles.lead}>Workflows to</span>
        <h1>
          <span className={styles.qtext}>{query}</span>
        </h1>
      </div>
      <p className={styles.subline}>
        Searched by goal, not by tool — matched on outcome, summary, and the
        steps inside each workflow.
      </p>

      {professions.length > 0 || tags.length > 0 ? (
        <div className={styles.filterrow}>
          <div className={styles.fgroup}>
            <span className={styles.flabel}>Profession</span>
            <Link
              href={buildSearchHref({ q: query, tag: activeTag, sort })}
              className={
                activeProfession
                  ? styles.chip
                  : `${styles.chip} ${styles.chipOn}`
              }
              aria-current={activeProfession ? undefined : "true"}
              scroll={false}
            >
              <span className={styles.dotmk} />
              All
            </Link>
            {professions.map((p) => {
              const on = activeProfession === p.slug;
              return (
                <Link
                  key={p.slug}
                  href={buildSearchHref({
                    q: query,
                    profession: on ? null : p.slug,
                    tag: activeTag,
                    sort,
                  })}
                  className={
                    on ? `${styles.chip} ${styles.chipOn}` : styles.chip
                  }
                  aria-current={on ? "true" : undefined}
                  scroll={false}
                >
                  <span className={styles.dotmk} />
                  {p.name}
                  {on ? (
                    <span className={styles.x}>
                      <X width={12} height={12} aria-hidden="true" />
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>

          {tags.length > 0 ? (
            <>
              <span className={styles.fdivider} />
              <div className={styles.fgroup}>
                <span className={styles.flabel}>Tags</span>
                {tags.map((t) => {
                  const on = activeTag === t.slug;
                  return (
                    <Link
                      key={t.slug}
                      href={buildSearchHref({
                        q: query,
                        profession: activeProfession,
                        tag: on ? null : t.slug,
                        sort,
                      })}
                      className={
                        on
                          ? `${styles.chip} ${styles.tag} ${styles.chipOn}`
                          : `${styles.chip} ${styles.tag}`
                      }
                      aria-current={on ? "true" : undefined}
                      scroll={false}
                    >
                      {t.label}
                    </Link>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
