"use client";

import { CalendarDays, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { FollowListDialog } from "./follow-list-dialog";
import { FollowUserButton } from "./follow-user-button";
import styles from "./profile.module.css";

/**
 * Story 9.1 — the interactive hero region: the clickable `.pcount` counts (→ Followers / Following
 * dialogs) + the `.pactions` row (Follow [non-owner] / Edit profile [owner] + Hire me). Owns the
 * optimistic follower count (the Follow button bumps it via `onToggle`); the viewed user's own
 * following count is static here (it only changes on THEIR follows, not the viewer's).
 */
export function ProfileSocial({
  targetId,
  targetHandle,
  isOwner,
  signedIn,
  viewerId,
  initialFollowing,
  followerCount: initialFollowerCount,
  followingCount,
  joinedLabel,
  hireMeUrl,
  hireMeVisible,
}: {
  targetId: string;
  targetHandle: string;
  isOwner: boolean;
  signedIn: boolean;
  viewerId: string | null;
  initialFollowing: boolean;
  followerCount: number;
  followingCount: number;
  joinedLabel: string;
  hireMeUrl: string | null;
  hireMeVisible: boolean;
}) {
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [openList, setOpenList] = useState<"followers" | "following" | null>(
    null,
  );

  return (
    <>
      <div className={styles.pcount}>
        <button
          type="button"
          className={styles.countBtn}
          onClick={() => setOpenList("followers")}
        >
          <b className="font-mono">{followerCount.toLocaleString()}</b>{" "}
          Followers
        </button>
        <span className={styles.sep} />
        <button
          type="button"
          className={styles.countBtn}
          onClick={() => setOpenList("following")}
        >
          <b className="font-mono">{followingCount.toLocaleString()}</b>{" "}
          Following
        </button>
        <span className={styles.sep} />
        <span className={styles.countItem}>
          <CalendarDays width={13} height={13} aria-hidden="true" />
          Joined {joinedLabel}
        </span>
      </div>

      <div className={styles.pactions}>
        {isOwner ? (
          <Link
            href="/settings/profile"
            className={cn(styles.btn, styles.btnGhost)}
          >
            Edit profile
          </Link>
        ) : (
          <FollowUserButton
            targetId={targetId}
            targetHandle={targetHandle}
            initialFollowing={initialFollowing}
            signedIn={signedIn}
            onToggle={(d) => setFollowerCount((c) => Math.max(0, c + d))}
          />
        )}
        {hireMeVisible && hireMeUrl ? (
          <a
            href={hireMeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(styles.btn, styles.btnGhost)}
          >
            <ExternalLink width={16} height={16} aria-hidden="true" />
            Hire me
          </a>
        ) : null}
      </div>

      <FollowListDialog
        open={openList === "followers"}
        onOpenChange={(o) => setOpenList(o ? "followers" : null)}
        profileId={targetId}
        mode="followers"
        signedIn={signedIn}
        viewerId={viewerId}
      />
      <FollowListDialog
        open={openList === "following"}
        onOpenChange={(o) => setOpenList(o ? "following" : null)}
        profileId={targetId}
        mode="following"
        signedIn={signedIn}
        viewerId={viewerId}
      />
    </>
  );
}
