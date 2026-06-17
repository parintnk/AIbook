"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { loadMoreBoardsAction } from "@/app/(app)/boards/actions";
import { thumbWash } from "@/lib/explore";
import type { BoardSummary } from "@/lib/services/boards";
import { cn } from "@/lib/utils";
import styles from "./boards.module.css";
import { NewBoardButton } from "./new-board-dialog";

/** Small deterministic wash for the rail thumbnail (mirrors the explore `t-*` palette). */
const WASH: Record<string, string> = {
  violet: "linear-gradient(140deg,#E4E0FF,#6D5EF0)",
  teal: "linear-gradient(140deg,#D6F2EC,#0E9E83)",
  rose: "linear-gradient(140deg,#FBE4F1,#C2548E)",
  amber: "linear-gradient(140deg,#FCEFD9,#D9923B)",
  indigo: "linear-gradient(140deg,#E0E7FF,#4F46E5)",
  slate: "linear-gradient(140deg,#DDE6F2,#5B7290)",
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.floor(diff / 60_000);
  return mins >= 1 ? `${mins}m ago` : "just now";
}

function metaText(b: BoardSummary): string {
  const vis = b.isPublic ? "Public" : "Private";
  if (b.itemCount === 0) return `${vis} · empty`;
  return b.lastSavedAt ? `${vis} · updated ${relTime(b.lastSavedAt)}` : vis;
}

/**
 * Story 8.2 — the "Your boards" switcher rail. Each board is a `<Link href="/boards?board=id">`
 * (SSR-selectable, shareable within the session); the active one is highlighted. "New board" sits
 * at the end; a "Show more boards" appender paginates the list (AC2). Owner-scoped by the page.
 */
export function BoardSwitcher({
  boards: initial,
  total,
  activeId,
}: {
  boards: BoardSummary[];
  total: number;
  activeId: string | null;
}) {
  const [boards, setBoards] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const allLoaded = boards.length >= total;

  function loadMore() {
    startTransition(async () => {
      const res = await loadMoreBoardsAction(boards.length);
      setBoards((p) => [...p, ...res.items]);
    });
  }

  return (
    <div className={styles.railcol}>
      <div className={styles.railTitle}>Your boards</div>
      <div className={styles.boardlist}>
        {boards.map((b) => (
          <Link
            key={b.id}
            href={`/boards?board=${b.id}`}
            className={cn(styles.boarditem, b.id === activeId && styles.on)}
            aria-current={b.id === activeId ? "page" : undefined}
          >
            <span
              className={styles.biThumb}
              style={{ background: WASH[thumbWash(b.id)] }}
            />
            <span className={styles.biBody}>
              <span className={styles.biName}>
                {b.name}
                {b.isPublic ? null : (
                  <span className={styles.lock}>
                    <Lock width={11} height={11} aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className={styles.biMeta}>{metaText(b)}</span>
            </span>
            <span className={cn(styles.biCount, "font-mono")}>
              {b.itemCount}
            </span>
          </Link>
        ))}
        <NewBoardButton variant="rail" />
      </div>
      {allLoaded ? null : (
        <button
          type="button"
          className={styles.railMore}
          onClick={loadMore}
          disabled={isPending}
        >
          {isPending
            ? "Loading…"
            : `Show more boards (${total - boards.length})`}
        </button>
      )}
    </div>
  );
}
