"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { compactAgo } from "@/lib/format/relative-time";
import type { CommentView } from "@/lib/services/comments";
import { cn } from "@/lib/utils";
import { CommentComposer } from "./comment-composer";

/**
 * One comment (Story 4.2 / UX-DR19): avatar + @handle + an "Author" tag when it's the
 * workflow's creator + a compact timestamp + body, then Reply / Like (+count) / ••• (a
 * Report STUB — Story 4.3 wires the real report dialog). Replies render nested ONE level
 * (the depth the schema enforces); a reply hides its own Reply button. A soft-deleted
 * comment (deleted_at, set only by 4.3 moderation) renders a "[comment removed]" tombstone.
 *
 * NOTE: the mockup's per-comment outcome vote-tag is intentionally DROPPED — Story 4.1
 * made individual votes private (own-only RLS); only the public Author tag is shown.
 */
export function CommentItem({
  comment,
  workflowAuthorId,
  canInteract,
  onToggleLike,
  onReply,
  isReply = false,
}: {
  comment: CommentView;
  workflowAuthorId: string;
  canInteract: boolean;
  onToggleLike: (commentId: string) => void;
  onReply: (parentId: string, body: string) => void;
  isReply?: boolean;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const author = comment.author;
  const handle = author?.handle ?? "unknown";
  const isAuthor = comment.author_id === workflowAuthorId;
  const deleted = comment.deleted_at != null;
  // An un-reconciled optimistic comment still carries a temp id (not a real UUID) —
  // disable Reply/Like on it so we never send `temp-N` as a parent / like target.
  const isOptimistic = comment.id.startsWith("temp-");

  return (
    <div className="flex gap-3">
      <ProfileAvatar
        avatarUrl={author?.avatar_url ?? null}
        displayName={author?.display_name ?? null}
        handle={handle}
        className={isReply ? "size-8 text-[10px]" : "size-9 text-[11px]"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[14px] text-foreground">
            @{handle}
          </span>
          {isAuthor ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 font-semibold text-[10px] text-accent-foreground uppercase tracking-wide ring-1 ring-accent-foreground/30">
              <StarIcon className="size-2.5" />
              Author
            </span>
          ) : null}
          <span className="font-mono text-[12px] text-muted-foreground">
            {compactAgo(comment.created_at)}
          </span>
        </div>

        {deleted ? (
          <p className="mt-1 text-[14px] text-muted-foreground italic">
            [comment removed]
          </p>
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words text-[14px] text-foreground/90 leading-relaxed">
            {comment.body}
          </p>
        )}

        {deleted ? null : (
          <div className="mt-2 flex items-center gap-4 text-[13px]">
            {!isReply && canInteract ? (
              <button
                type="button"
                disabled={isOptimistic}
                onClick={() => setReplyOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 font-medium text-muted-foreground transition enabled:hover:text-foreground disabled:opacity-50"
              >
                <ReplyIcon className="size-3.5" />
                Reply
              </button>
            ) : null}
            <button
              type="button"
              disabled={!canInteract || isOptimistic}
              aria-pressed={comment.likedByMe}
              aria-label={comment.likedByMe ? "Unlike comment" : "Like comment"}
              onClick={() => canInteract && onToggleLike(comment.id)}
              className={cn(
                "inline-flex items-center gap-1.5 font-medium transition disabled:cursor-default",
                comment.likedByMe
                  ? "text-accent-foreground"
                  : "text-muted-foreground enabled:hover:text-foreground",
              )}
            >
              <HeartIcon className="size-3.5" filled={comment.likedByMe} />
              Like
              {comment.like_count > 0 ? (
                <span className="font-mono text-[12px]">
                  {comment.like_count}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              title="More — report"
              aria-label="More actions"
              onClick={() =>
                toast("Reporting comments arrives in a later update.")
              }
              className="ml-auto inline-flex items-center rounded-md px-1 text-muted-foreground transition hover:text-foreground"
            >
              <DotsIcon className="size-4" />
            </button>
          </div>
        )}

        {replyOpen && canInteract ? (
          <CommentComposer
            variant="reply"
            canComment={canInteract}
            onSubmit={(body) => {
              onReply(comment.id, body);
              setReplyOpen(false);
            }}
            onCancel={() => setReplyOpen(false)}
          />
        ) : null}

        {comment.replies.length > 0 ? (
          <div className="mt-3 flex flex-col gap-3 border-l border-border pl-4">
            {comment.replies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                workflowAuthorId={workflowAuthorId}
                canInteract={canInteract}
                onToggleLike={onToggleLike}
                onReply={onReply}
                isReply
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      className={className}
    >
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01Z" />
    </svg>
  );
}

function ReplyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 17 4 12l5-5" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function HeartIcon({
  className,
  filled,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    </svg>
  );
}

function DotsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      className={className}
    >
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
