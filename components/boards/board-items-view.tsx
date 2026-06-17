"use client";

import { ChevronDown } from "lucide-react";
import { useState, useTransition } from "react";
import { loadMoreBoardItemsAction } from "@/app/(app)/boards/actions";
import exploreStyles from "@/components/workflows/explore.module.css";
import { WorkflowCard } from "@/components/workflows/workflow-card";
import type { WorkflowCardData } from "@/lib/explore";

/**
 * Story 8.2 — the READ-ONLY board item grid for the public `/boards/[id]` view (no drag, no
 * remove). Plain explore feed cards (a signed-in viewer can still Save an item into their own
 * board via the card's savemark — the 8.1 reuse). Paginated via the same Load-more pattern (AC2).
 */
export function BoardItemsView({
  boardId,
  initialItems,
  total,
  signedIn,
}: {
  boardId: string;
  initialItems: WorkflowCardData[];
  total: number;
  signedIn: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const allLoaded = items.length >= total;

  function loadMore() {
    startTransition(async () => {
      const res = await loadMoreBoardItemsAction(boardId, items.length);
      setItems((p) => [...p, ...res.items]);
    });
  }

  return (
    <>
      <div className={exploreStyles.feedgrid}>
        {items.map((w) => (
          <WorkflowCard key={w.id} data={w} signedIn={signedIn} />
        ))}
      </div>
      <div className={exploreStyles.loadmore}>
        <div className={exploreStyles.count} aria-live="polite">
          {allLoaded ? (
            "You're all caught up"
          ) : (
            <>
              Showing <span className={exploreStyles.mono}>{items.length}</span>{" "}
              of <span className={exploreStyles.mono}>{total}</span>
            </>
          )}
        </div>
        {allLoaded ? null : (
          <button
            type="button"
            className={exploreStyles.loadBtn}
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
