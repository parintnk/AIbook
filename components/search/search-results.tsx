"use client";

import { ChevronDown } from "lucide-react";
import { useState, useTransition } from "react";
import { loadMoreSearchAction } from "@/app/(app)/search/actions";
import type { SearchResultCard as Card, SearchSort } from "@/lib/search";
import styles from "./search.module.css";
import { SearchResultCard } from "./search-result-card";

/**
 * The semantic results grid + in-place "Load more" (mockup `.results` + "Showing X of Y"). Mirrors
 * `ExploreFeed`: append-on-load (scroll preserved — it never navigates), `aria-live` showing-count
 * flipping to "all caught up". Threads the resolved `professionId`/`tagIds`/`sort` to the action so
 * pagination stays within the current view. The keyword fallback (degraded) renders separately.
 */
export function SearchResults({
  query,
  professionId,
  tagIds,
  sort,
  initialItems,
  total,
  signedIn,
}: {
  query: string;
  professionId: string | null;
  tagIds: string[] | null;
  sort: SearchSort;
  initialItems: Card[];
  total: number;
  signedIn: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [exhausted, setExhausted] = useState(false);
  const [pending, startTransition] = useTransition();
  const done = exhausted || items.length >= total;

  function loadMore() {
    if (pending) return;
    startTransition(async () => {
      const res = await loadMoreSearchAction({
        query,
        professionId,
        tagIds,
        sort,
        offset: items.length,
      });
      // A page that came back empty (a TOCTOU gap, or past the bounded match window) or that DEGRADED
      // to keyword results mid-session must NOT be spliced into the semantic grid (different ranking,
      // no matchPct, possible duplicate ids) — stop cleanly instead.
      if (res.degraded || res.items.length === 0) {
        setExhausted(true);
        return;
      }
      setItems((prev) => [...prev, ...res.items]);
    });
  }

  return (
    <>
      <div className={styles.results} data-testid="search-results">
        {items.map((it) => (
          <SearchResultCard key={it.id} data={it} signedIn={signedIn} />
        ))}
      </div>
      <div className={styles.loadwrap}>
        <div className={styles.showing} aria-live="polite">
          {done ? (
            "You're all caught up"
          ) : (
            <>
              Showing {items.length} of {total}
            </>
          )}
        </div>
        {done ? null : (
          <button
            type="button"
            className={styles.loadbtn}
            onClick={loadMore}
            disabled={pending}
          >
            {pending ? "Loading…" : "Load more"}
            <ChevronDown width={16} height={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  );
}
