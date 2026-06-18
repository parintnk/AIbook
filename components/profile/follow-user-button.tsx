"use client";

import { Check, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { followUserAction, unfollowUserAction } from "@/app/(app)/u/actions";
import { cn } from "@/lib/utils";
import styles from "./profile.module.css";

/**
 * Story 9.1 / FR21 — Follow / Unfollow a user. Optimistic toggle + revert-on-failure + `isPending`
 * guard + `useEffect` resync (the JoinButton / follow-board-button pattern). Violet "Follow" ↔ a
 * neutral-glass "Following" (the shipped board-Follow treatment — distinct via the check icon + label).
 * Signed-out → a sign-in link. `onToggle(delta)` lets a parent move an optimistic follower count.
 * `isSelf` (a list row that is the viewer, or the profile owner) renders nothing — you can't follow yourself.
 */
export function FollowUserButton({
  targetId,
  targetHandle,
  initialFollowing,
  signedIn,
  size = "lg",
  isSelf = false,
  onToggle,
}: {
  targetId: string;
  targetHandle: string;
  initialFollowing: boolean;
  signedIn: boolean;
  size?: "lg" | "sm";
  isSelf?: boolean;
  onToggle?: (delta: 1 | -1) => void;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();
  useEffect(() => setFollowing(initialFollowing), [initialFollowing]);

  if (isSelf) return null;

  const iconSize = size === "sm" ? 14 : 16;
  const cls = cn(
    styles.btn,
    size === "sm" && styles.btnSm,
    following ? styles.btnGhost : styles.btnPrimary,
  );

  if (!signedIn) {
    return (
      <Link href={`/sign-in?next=/u/${targetHandle}`} className={cls}>
        <UserPlus width={iconSize} height={iconSize} aria-hidden="true" />
        Follow
      </Link>
    );
  }

  function toggle() {
    if (isPending) return;
    const next = !following;
    setFollowing(next); // optimistic
    onToggle?.(next ? 1 : -1);
    startTransition(async () => {
      const res = next
        ? await followUserAction(targetId, targetHandle)
        : await unfollowUserAction(targetId, targetHandle);
      if (!res.ok) {
        setFollowing(!next); // revert
        onToggle?.(next ? -1 : 1);
        toast.error(res.error);
      }
    });
  }

  return (
    <button
      type="button"
      className={cls}
      onClick={toggle}
      disabled={isPending}
      aria-pressed={following}
    >
      {following ? (
        <>
          <Check width={iconSize} height={iconSize} aria-hidden="true" />
          Following
        </>
      ) : (
        <>
          <UserPlus width={iconSize} height={iconSize} aria-hidden="true" />
          Follow
        </>
      )}
    </button>
  );
}
