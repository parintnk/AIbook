"use client";

import { ChevronDown } from "lucide-react";
import { useState, useTransition } from "react";
import { loadMoreAuthorPublishedAction } from "@/app/(app)/u/actions";
import styles from "@/components/workflows/explore.module.css";
import { WorkflowCard } from "@/components/workflows/workflow-card";
import type { WorkflowCardData } from "@/lib/explore";

/**
 * The profile "Contributions" grid (Story 9.x) — an author's published workflows, most-forked first,
 * with the same SSR-seeded in-place "Load more" as the Explore feed (no nav, "Showing X of Y").
 * Reuses WorkflowCard + explore.module.css verbatim so a profile card is byte-identical to a feed card.
 */
export function ProfilePublishedFeed({
  authorId,
  initialItems,
  total,
  signedIn = false,
  isOwner = false,
}: {
  authorId: string;
  initialItems: WorkflowCardData[];
  total: number;
  signedIn?: boolean;
  isOwner?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();

  if (total === 0) {
    return (
      <div className={styles.empty}>
        <p>
          {isOwner
            ? "You haven't published a workflow yet."
            : "Nothing published yet."}
        </p>
      </div>
    );
  }

  const allLoaded = items.length >= total;

  function loadMore() {
    startTransition(async () => {
      const res = await loadMoreAuthorPublishedAction(authorId, items.length);
      setItems((prev) => [...prev, ...res.items]);
    });
  }

  return (
    <>
      <div className={styles.feedgrid}>
        {items.map((w) => (
          <WorkflowCard key={w.id} data={w} signedIn={signedIn} />
        ))}
      </div>
      <div className={styles.loadmore}>
        <div className={styles.count} aria-live="polite">
          {allLoaded ? (
            "You're all caught up"
          ) : (
            <>
              Showing <span className={styles.mono}>{items.length}</span> of{" "}
              <span className={styles.mono}>{total}</span>
            </>
          )}
        </div>
        {allLoaded ? null : (
          <button
            type="button"
            className={styles.loadBtn}
            onClick={loadMore}
            disabled={isPending}
          >
            {isPending ? "Loading…" : "Load more"}
            <ChevronDown width={16} height={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  );
}
