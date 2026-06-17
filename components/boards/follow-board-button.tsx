"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  followBoardAction,
  unfollowBoardAction,
} from "@/app/(app)/boards/actions";
import { cn } from "@/lib/utils";
import styles from "./boards.module.css";

/**
 * Story 8.2 / FR21 — Follow / Unfollow a public board (shown on `/boards/[id]` to a non-owner).
 * Optimistic toggle + revert-on-failure + `isPending` guard + `useEffect` resync (the JoinButton
 * pattern). Signed-out → a sign-in link (no follow happens until they return).
 */
export function FollowBoardButton({
  boardId,
  isFollowing: initial,
  signedIn,
}: {
  boardId: string;
  isFollowing: boolean;
  signedIn: boolean;
}) {
  const [following, setFollowing] = useState(initial);
  const [isPending, startTransition] = useTransition();
  useEffect(() => setFollowing(initial), [initial]);

  if (!signedIn) {
    return (
      <Link
        href={`/sign-in?next=/boards/${boardId}`}
        className={cn(styles.btn, styles.btnPrimary)}
      >
        <Plus width={16} height={16} aria-hidden="true" />
        Follow
      </Link>
    );
  }

  function toggle() {
    if (isPending) return;
    const next = !following;
    setFollowing(next); // optimistic
    startTransition(async () => {
      const res = next
        ? await followBoardAction(boardId)
        : await unfollowBoardAction(boardId);
      if (!res.ok) {
        setFollowing(!next); // revert
        toast.error(res.error);
      }
    });
  }

  return (
    <button
      type="button"
      className={cn(
        styles.btn,
        following ? styles.btnGhost : styles.btnPrimary,
      )}
      onClick={toggle}
      disabled={isPending}
      aria-pressed={following}
    >
      {following ? (
        <>
          <Check width={16} height={16} aria-hidden="true" />
          Following
        </>
      ) : (
        <>
          <Plus width={16} height={16} aria-hidden="true" />
          Follow
        </>
      )}
    </button>
  );
}
