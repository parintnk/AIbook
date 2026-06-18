import { Check, Moon, Search } from "lucide-react";
import Link from "next/link";
import { workedPct } from "@/lib/explore";
import { highlightTerms, type SearchResultCard } from "@/lib/search";
import styles from "./search.module.css";

/**
 * The transparent FTS keyword fallback (Story 10.3, absorbed — mockup `.fallback`). Rendered when the
 * embedding service is unavailable (`degraded`): a quiet "Semantic search is resting" note + compact
 * keyword rows (`<mark>`-highlighted titles), NEVER an error/empty screen (FR2 "done-when").
 */
export function KeywordFallback({
  query,
  items,
  total,
}: {
  query: string;
  items: SearchResultCard[];
  total: number;
}) {
  return (
    <section className={styles.fallback} aria-label="Keyword results">
      <div className={styles.fbStatebar}>
        <span className={styles.fbTag}>Keyword fallback</span>
        <span className={styles.fbMeta}>
          <Moon width={13} height={13} aria-hidden="true" />
          semantic search unavailable · degraded gracefully
        </span>
      </div>
      <div className={styles.fbBody}>
        <div className={styles.restnote}>
          <span className={styles.zi}>
            <Moon width={17} height={17} aria-hidden="true" />
          </span>
          <div className={styles.rt}>
            Semantic search is resting — showing keyword matches.
            <span>
              Same goal, matched on words instead of meaning. Results still here
              — nothing was lost.
            </span>
          </div>
        </div>
        <div className={styles.fbCount} aria-live="polite">
          <Search width={13} height={13} aria-hidden="true" />
          <span>
            <b>{total}</b>{" "}
            <span className={styles.kw}>
              keyword {total === 1 ? "match" : "matches"}
            </span>{" "}
            for “{query}”
          </span>
        </div>
        {items.length > 0 ? (
          <div className={styles.fbResults}>
            {items.map((it) => {
              const pct = workedPct(it.workedScore, it.triedCount);
              return (
                <Link
                  key={it.id}
                  href={`/workflows/${it.id}`}
                  className={styles.kwrow}
                >
                  <div className={styles.kwthumb}>
                    <Search width={16} height={16} aria-hidden="true" />
                  </div>
                  <div className={styles.km}>
                    <h5>
                      {highlightTerms(it.title, query).map((seg, i) =>
                        seg.mark ? (
                          <mark key={`${i}-${seg.t}`}>{seg.t}</mark>
                        ) : (
                          <span key={`${i}-${seg.t}`}>{seg.t}</span>
                        ),
                      )}
                    </h5>
                    <div className={styles.ksub}>
                      {it.authorHandle ? <span>@{it.authorHandle}</span> : null}
                      {it.professionName ? (
                        <span>· {it.professionName}</span>
                      ) : null}
                    </div>
                  </div>
                  {pct !== null ? (
                    <span className={styles.kscore}>
                      <Check width={11} height={11} aria-hidden="true" />
                      {pct}%
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
