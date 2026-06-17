import { Bookmark, Globe, GripVertical, Lock, Users } from "lucide-react";
import Link from "next/link";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import type { BoardDetail } from "@/lib/services/boards";
import { cn } from "@/lib/utils";
import { BoardOverflowMenu } from "./board-overflow-menu";
import styles from "./boards.module.css";
import { FollowBoardButton } from "./follow-board-button";
import { ShareBoardButton } from "./share-board-button";
import { VisibilityToggle } from "./visibility-toggle";

/**
 * Story 8.2 — the active board's header. Server component composing the client controls:
 * - `mode="manage"` (the /boards owner surface): editable Public/Private toggle + ••• (rename /
 *   delete) + a read-only "Followed by N" stat + Share + a reorder hint. NO Follow (it's mine).
 * - `mode="view"` (the public /boards/[id]): a static visibility badge + Share + Follow (non-owner)
 *   or "Manage in Saved →" (owner). The follower count shows for everyone.
 */
export function BoardHeader({
  board,
  mode,
  signedIn,
}: {
  board: BoardDetail;
  mode: "manage" | "view";
  signedIn: boolean;
}) {
  const manage = mode === "manage";
  return (
    <div className={styles.boardhead}>
      <div className={styles.bhTop}>
        <div className={styles.bhTitlewrap}>
          <div className={styles.bhTitle}>
            {board.name}
            {manage ? (
              <VisibilityToggle boardId={board.id} isPublic={board.isPublic} />
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground text-xs">
                {board.isPublic ? (
                  <Globe width={13} height={13} aria-hidden="true" />
                ) : (
                  <Lock width={13} height={13} aria-hidden="true" />
                )}
                {board.isPublic ? "Public" : "Private"}
              </span>
            )}
          </div>
          <div className={styles.bhOwner}>
            <ProfileAvatar
              avatarUrl={null}
              displayName={null}
              handle={board.ownerHandle ?? "?"}
              className="size-[30px] shrink-0"
            />
            <span className={styles.by}>
              by{" "}
              <b>
                {board.isOwner ? "you" : `@${board.ownerHandle ?? "someone"}`}
              </b>
              {board.isOwner && board.ownerHandle
                ? ` · @${board.ownerHandle}`
                : ""}
            </span>
            <span className={styles.sep} />
            <span className={styles.bhFollowers}>
              <Users width={15} height={15} aria-hidden="true" />
              Followed by <b className="font-mono">{board.followerCount}</b>
            </span>
          </div>
        </div>
        <div className={styles.bhActions}>
          <ShareBoardButton boardId={board.id} isPublic={board.isPublic} />
          {manage ? (
            <BoardOverflowMenu
              boardId={board.id}
              name={board.name}
              itemCount={board.itemCount}
            />
          ) : board.isOwner ? (
            <Link
              href={`/boards?board=${board.id}`}
              className={cn(styles.btn, styles.btnGhost)}
            >
              Manage in Saved →
            </Link>
          ) : (
            <FollowBoardButton
              boardId={board.id}
              isFollowing={board.isFollowing}
              signedIn={signedIn}
            />
          )}
        </div>
      </div>
      <div className={styles.bhFoot}>
        <span className={styles.bhCount}>
          <Bookmark width={15} height={15} aria-hidden="true" />
          <b className="font-mono">{board.itemCount}</b>&nbsp;workflows saved
        </span>
        {manage && board.itemCount > 1 ? (
          <span className={styles.reorderhint}>
            <GripVertical width={14} height={14} aria-hidden="true" />
            Drag the handle on a card to reorder
          </span>
        ) : null}
      </div>
    </div>
  );
}
