"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { loadMoreWorkflowsAction } from "@/app/(app)/explore/actions";
import styles from "@/components/workflows/explore.module.css";
import { WorkflowCard } from "@/components/workflows/workflow-card";
import type { WorkflowCardData, WorkflowSort } from "@/lib/explore";

/**
 * The Trending feed grid + in-place pagination (UX-DR17). Seeded with the SSR first page;
 * "Load more" appends the next page via a Server Action WITHOUT navigating (scroll position
 * preserved), updates the "Showing X of Y" count (announced via aria-live), and flips to
 * "You're all caught up" when the feed is exhausted. Reset across filter/sort changes by a
 * `key` on the parent (the page remounts this with fresh `initialItems`).
 */
export function ExploreFeed({
  initialItems,
  total,
  sort,
  profession,
  professionName,
  tag = null,
  hideCommunityChip = false,
}: {
  initialItems: WorkflowCardData[];
  total: number;
  sort: WorkflowSort;
  profession: string | null;
  professionName: string | null;
  /** Active tag slug (Story 6.2 community feed) — preserved across Load more. */
  tag?: string | null;
  /** On a profession's community page the profession is implied → drop the per-card
   *  community chip (Story 6.2 / AC2). Applies to both the SSR + Load-more cards. */
  hideCommunityChip?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();

  if (total === 0) {
    return (
      <div className={styles.empty}>
        <p>
          {tag
            ? "No workflows match this tag yet."
            : profession
              ? `No workflows in ${professionName ?? profession} yet. Be the first to publish one.`
              : "Nothing published yet."}
        </p>
        <Link
          href="/workflows/new"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm"
        >
          New workflow
        </Link>
      </div>
    );
  }

  const allLoaded = items.length >= total;

  function loadMore() {
    startTransition(async () => {
      const res = await loadMoreWorkflowsAction({
        sort,
        profession,
        tag,
        offset: items.length,
      });
      setItems((prev) => [...prev, ...res.items]);
    });
  }

  return (
    <>
      <div className={styles.feedgrid} data-testid="trending-feed">
        {items.map((w) => (
          <WorkflowCard
            key={w.id}
            data={hideCommunityChip ? { ...w, professionName: null } : w}
          />
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
