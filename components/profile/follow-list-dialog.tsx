"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  loadMoreFollowersAction,
  loadMoreFollowingAction,
} from "@/app/(app)/u/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProfileCardData } from "@/lib/follows";
import { FollowUserButton } from "./follow-user-button";
import styles from "./profile.module.css";
import { ProfileAvatar } from "./profile-avatar";

/**
 * Story 9.1 — the Followers / Following list (No13 Q1). A responsive Dialog → bottom Sheet on phone.
 * Lazy-loads page 1 the first time it opens (the SaveToBoardDialog pattern), then paginates
 * ("Load more" + "Showing X of Y" + aria-live). The follow graph is public-read so anon can browse;
 * each row offers Follow-back (auth-gated; hidden on the viewer's own row).
 */
export function FollowListDialog({
  open,
  onOpenChange,
  profileId,
  mode,
  signedIn,
  viewerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  mode: "followers" | "following";
  signedIn: boolean;
  viewerId: string | null;
}) {
  const [items, setItems] = useState<ProfileCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const action =
    mode === "followers" ? loadMoreFollowersAction : loadMoreFollowingAction;

  // Re-fetch page 1 every time the dialog opens (the SaveToBoardDialog precedent) so a reopen after a
  // follow/unfollow shows a fresh list + count, never a stale cache. The `cancelled` guard drops a
  // slow resolve that lands after a close/reopen.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    startTransition(async () => {
      const res = await action(profileId, 0);
      if (cancelled) return;
      setItems(res.items);
      setTotal(res.total);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, action, profileId]);

  function loadMore() {
    if (isPending) return;
    startTransition(async () => {
      const res = await action(profileId, items.length);
      setItems((prev) => [...prev, ...res.items]);
      setTotal(res.total);
    });
  }

  const allLoaded = loaded && items.length >= total;
  const title = mode === "followers" ? "Followers" : "Following";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {loaded && items.length === 0 ? (
          <p className={styles.emptyList}>
            {mode === "followers"
              ? "No followers yet."
              : "Not following anyone yet."}
          </p>
        ) : (
          <div className={styles.followList}>
            {items.map((u) => (
              <div key={u.id} className={styles.followRow}>
                <ProfileAvatar
                  avatarUrl={u.avatarUrl}
                  displayName={u.displayName}
                  handle={u.handle}
                  className={styles.followAvatar}
                />
                <div className={styles.followInfo}>
                  <Link
                    href={`/u/${u.handle}`}
                    className={styles.followName}
                    onClick={() => onOpenChange(false)}
                  >
                    {u.displayName ?? `@${u.handle}`}
                  </Link>
                  <div className={styles.followHandle}>@{u.handle}</div>
                  {u.professionName ? (
                    <div className={styles.followProfession}>
                      {u.professionName}
                    </div>
                  ) : null}
                </div>
                <div className={styles.followAction}>
                  <FollowUserButton
                    targetId={u.id}
                    targetHandle={u.handle}
                    initialFollowing={u.isFollowing}
                    signedIn={signedIn}
                    size="sm"
                    isSelf={u.id === viewerId}
                  />
                </div>
              </div>
            ))}
            {!loaded ? <p className={styles.listMeta}>Loading…</p> : null}
            {loaded && !allLoaded ? (
              <button
                type="button"
                className={styles.loadMore}
                onClick={loadMore}
                disabled={isPending}
              >
                {isPending ? "Loading…" : "Load more"}
              </button>
            ) : null}
            {loaded && total > 0 ? (
              <p className={styles.listMeta} aria-live="polite">
                {allLoaded
                  ? `All ${total} shown`
                  : `Showing ${items.length} of ${total}`}
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
