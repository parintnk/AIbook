"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteCommentAction,
  loadMoreCommentsAction,
  postCommentAction,
  toggleCommentLikeAction,
} from "@/app/(app)/workflows/actions";
import type { CommentSort, CommentView } from "@/lib/services/comments";
import { cn } from "@/lib/utils";
import { CommentComposer } from "./comment-composer";
import { CommentItem } from "./comment-item";

/**
 * The comment thread (Story 4.2 / FR19 / UX-DR19 / UX-DR17). Owns the loaded-page state
 * client-side: optimistic post / reply / like (revert + toast on error), Top/Newest sort,
 * and "Load more" (offset pagination, scroll-preserving, `aria-live` count, "You're all
 * caught up" when exhausted). The actions don't `router.refresh()` — that would reset the
 * loaded pages; the dynamic route re-fetches fresh on a cold reload / back-nav.
 */

type CurrentUser = {
  id: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
};

function updateInTree(
  list: CommentView[],
  id: string,
  fn: (c: CommentView) => CommentView,
): CommentView[] {
  return list.map((c) => {
    if (c.id === id) return fn(c);
    if (c.replies.some((r) => r.id === id)) {
      return { ...c, replies: c.replies.map((r) => (r.id === id ? fn(r) : r)) };
    }
    return c;
  });
}

export function CommentThread({
  workflowId,
  workflowAuthorId,
  initialComments,
  initialHasMore,
  total: initialTotal,
  currentUser,
}: {
  workflowId: string;
  workflowAuthorId: string;
  initialComments: CommentView[];
  initialHasMore: boolean;
  total: number;
  currentUser: CurrentUser | null;
}) {
  const [comments, setComments] = useState<CommentView[]>(initialComments);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [sort, setSort] = useState<CommentSort>("top");
  const [offset, setOffset] = useState(initialComments.length);
  const [announce, setAnnounce] = useState("");
  const [isPending, startTransition] = useTransition();
  const tempRef = useRef(0);

  const canComment = currentUser != null;
  const rendered = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  function tempComment(body: string, parentId: string | null): CommentView {
    tempRef.current += 1;
    const nowIso = new Date().toISOString();
    return {
      id: `temp-${tempRef.current}`,
      workflow_id: workflowId,
      author_id: currentUser?.id ?? "",
      parent_comment_id: parentId,
      body,
      like_count: 0,
      deleted_at: null,
      created_at: nowIso,
      updated_at: nowIso,
      author: currentUser
        ? {
            handle: currentUser.handle,
            display_name: currentUser.displayName,
            avatar_url: currentUser.avatarUrl,
          }
        : null,
      likedByMe: false,
      replies: [],
    };
  }

  function postTopLevel(body: string) {
    if (!canComment) return;
    const temp = tempComment(body, null);
    setComments((prev) => [temp, ...prev]);
    setTotal((t) => t + 1);
    startTransition(async () => {
      const res = await postCommentAction(workflowId, body, null);
      if (res.ok) {
        // preserve any optimistic replies attached to the temp (postComment
        // returns replies:[]); the temp guard below also blocks replying to a temp.
        setComments((prev) =>
          prev.map((c) =>
            c.id === temp.id ? { ...res.comment, replies: c.replies } : c,
          ),
        );
        setAnnounce("Your comment was posted.");
      } else {
        setComments((prev) => prev.filter((c) => c.id !== temp.id));
        setTotal((t) => Math.max(0, t - 1));
        toast.error("Couldn't post your comment. Try again.");
      }
    });
  }

  function postReply(parentId: string, body: string) {
    if (!canComment) return;
    const temp = tempComment(body, parentId);
    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId ? { ...c, replies: [...c.replies, temp] } : c,
      ),
    );
    setTotal((t) => t + 1);
    startTransition(async () => {
      const res = await postCommentAction(workflowId, body, parentId);
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== parentId) return c;
          if (res.ok) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === temp.id ? res.comment : r,
              ),
            };
          }
          return { ...c, replies: c.replies.filter((r) => r.id !== temp.id) };
        }),
      );
      if (res.ok) {
        setAnnounce("Your reply was posted.");
      } else {
        setTotal((t) => Math.max(0, t - 1));
        toast.error("Couldn't post your reply. Try again.");
      }
    });
  }

  function toggleLike(commentId: string) {
    if (!canComment) return;
    const flip = (c: CommentView): CommentView => ({
      ...c,
      likedByMe: !c.likedByMe,
      like_count: Math.max(0, c.like_count + (c.likedByMe ? -1 : 1)),
    });
    setComments((prev) => updateInTree(prev, commentId, flip));
    startTransition(async () => {
      const res = await toggleCommentLikeAction(commentId);
      if (!res.ok) {
        setComments((prev) => updateInTree(prev, commentId, flip)); // toggle again = revert
        toast.error("Couldn't update your like. Try again.");
      }
    });
  }

  function deleteComment(commentId: string) {
    if (!canComment) return;
    const setDeleted = (at: string | null) => (c: CommentView) => ({
      ...c,
      deleted_at: at,
    });
    const nowIso = new Date().toISOString();
    setComments((prev) => updateInTree(prev, commentId, setDeleted(nowIso)));
    startTransition(async () => {
      const res = await deleteCommentAction(commentId);
      if (!res.ok) {
        setComments((prev) => updateInTree(prev, commentId, setDeleted(null)));
        toast.error("Couldn't delete your comment. Try again.");
      }
    });
  }

  function loadMore() {
    if (isPending) return; // in-flight guard: a 2nd click must not re-fetch the same offset
    startTransition(async () => {
      const page = await loadMoreCommentsAction(workflowId, sort, offset);
      setComments((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...page.comments.filter((c) => !seen.has(c.id))];
      });
      setOffset((o) => o + page.comments.length);
      setHasMore(page.hasMore);
      setAnnounce(`Loaded ${page.comments.length} more comments`);
    });
  }

  function changeSort(next: CommentSort) {
    // bail while a post/reply/load is in flight — replacing the list mid-reconcile
    // would drop the optimistic temp (its saved comment would vanish until reload).
    if (next === sort || isPending) return;
    setSort(next);
    startTransition(async () => {
      const page = await loadMoreCommentsAction(workflowId, next, 0);
      setComments(page.comments);
      setOffset(page.comments.length);
      setHasMore(page.hasMore);
    });
  }

  return (
    <section className="mt-8 border-border border-t pt-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-2 font-heading font-bold text-foreground text-lg">
          Comments
          <span className="font-mono font-normal text-[13px] text-muted-foreground">
            {total}
          </span>
        </h2>
        <div className="flex gap-1 rounded-xl bg-secondary p-0.5">
          {(["top", "new"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sort === s}
              disabled={isPending}
              onClick={() => changeSort(s)}
              className={cn(
                "rounded-lg px-3 py-1 font-medium text-[12px] transition disabled:opacity-50",
                sort === s
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground enabled:hover:text-foreground",
              )}
            >
              {s === "top" ? "Top" : "Newest"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <CommentComposer
          canComment={canComment}
          onSubmit={postTopLevel}
          pending={isPending}
        />
      </div>

      <div className="mt-5 flex flex-col gap-5">
        {comments.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-muted-foreground">
            No comments yet — be the first to share what worked.
          </p>
        ) : (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              workflowAuthorId={workflowAuthorId}
              currentUserId={currentUser?.id ?? null}
              canInteract={canComment}
              onToggleLike={toggleLike}
              onReply={postReply}
              onDelete={deleteComment}
            />
          ))
        )}
      </div>

      {comments.length > 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 border-border border-t pt-5">
          <p className="font-mono text-[12px] text-muted-foreground">
            Showing {rendered} of {total} comments
          </p>
          {hasMore && rendered < total ? (
            <button
              type="button"
              disabled={isPending}
              onClick={loadMore}
              className="rounded-full border border-border px-4 py-1.5 font-medium text-[13px] text-foreground transition enabled:hover:bg-muted disabled:opacity-50"
            >
              {isPending ? "Loading…" : "Load more"}
            </button>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              You&rsquo;re all caught up
            </p>
          )}
        </div>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
    </section>
  );
}
