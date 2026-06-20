import "server-only";
import { cache } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";

/**
 * Comments domain/service layer (Story 4.2 / FR19) — the ONLY place comments +
 * comment_likes SQL lives. Threaded discussion (top-level + ONE level of replies) on a
 * PUBLISHED workflow. Reads are public (RLS: published-read); writes are the author's
 * own. `like_count` is denormalized on `comments`, maintained by a ±1 trigger — this
 * layer never writes it. A like is a per-(comment, user) toggle (PK blocks double-like).
 *
 * Pagination is OFFSET-based on TOP-LEVEL comments (replies load with their parent) —
 * simple + reliable for the "Load more" / "Showing X of Y" UX; keyset is a future
 * refinement if concurrent-insert churn on a single thread becomes an issue.
 */

export type Comment = Tables<"comments">;

export type CommentAuthor = {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** A comment enriched for the viewer: author profile, my-like state, and (top-level only) its replies. */
export type CommentView = Comment & {
  author: CommentAuthor | null;
  likedByMe: boolean;
  replies: CommentView[];
};

export type CommentSort = "top" | "new";

export type CommentPage = { comments: CommentView[]; hasMore: boolean };

export type PostCommentResult =
  | { ok: true; comment: CommentView }
  | { ok: false; error: "not_authenticated" | "db_error" };

export type ToggleLikeResult =
  | { ok: true; liked: boolean }
  | { ok: false; error: "not_authenticated" | "db_error" };

export type DeleteCommentResult =
  | { ok: true }
  | { ok: false; error: "not_authenticated" | "db_error" };

export const COMMENTS_PAGE_SIZE = 10;

const AUTHOR_SELECT =
  "*, author:profiles!comments_author_id_fkey(handle, display_name, avatar_url)";

type Row = Comment & { author: CommentAuthor | null };

/** Total comments (top-level + replies) on a workflow — the "{N} comments" heading + the "of Y". */
export const countComments = cache(
  async (workflowId: string): Promise<number> => {
    const supabase = await createClient();
    const { count } = await supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("workflow_id", workflowId);
    return count ?? 0;
  },
);

/**
 * A page of TOP-LEVEL comments (sorted) on a published workflow, each with its replies
 * (chronological) + the author profile + my-like state. `hasMore` = a full page came
 * back (try "Load more"). Anon → likedByMe=false everywhere.
 */
export const listCommentPage = cache(
  async (
    workflowId: string,
    opts?: { sort?: CommentSort; limit?: number; offset?: number },
  ): Promise<CommentPage> => {
    const sort = opts?.sort ?? "top";
    const limit = opts?.limit ?? COMMENTS_PAGE_SIZE;
    const offset = opts?.offset ?? 0;
    const supabase = await createClient();
    const user = await getCurrentUser();

    // 1) top-level page ("top" = most-liked w/ created_at tiebreak; "new" = most-recent)
    const base = supabase
      .from("comments")
      .select(AUTHOR_SELECT)
      .eq("workflow_id", workflowId)
      .is("parent_comment_id", null);
    // A trailing UNIQUE tiebreaker (id) makes the order total → offset pages can't
    // skip/duplicate rows that tie on like_count/created_at (e.g. 0-like burst inserts).
    const ordered =
      sort === "top"
        ? base
            .order("like_count", { ascending: false })
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
        : base
            .order("created_at", { ascending: false })
            .order("id", { ascending: false });
    const { data: tops } = await ordered.range(offset, offset + limit - 1);

    const topRows = (tops ?? []) as Row[];
    if (topRows.length === 0) return { comments: [], hasMore: false };

    // 2) replies for these parents (chronological)
    const parentIds = topRows.map((c) => c.id);
    const { data: replyData } = await supabase
      .from("comments")
      .select(AUTHOR_SELECT)
      .in("parent_comment_id", parentIds)
      .order("created_at", { ascending: true });
    const replyRows = (replyData ?? []) as Row[];

    // 3) my likes across every loaded comment (signed-in only)
    const allIds = [...parentIds, ...replyRows.map((r) => r.id)];
    let likedSet = new Set<string>();
    if (user && allIds.length > 0) {
      const { data: likes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("profile_id", user.id)
        .in("comment_id", allIds);
      likedSet = new Set((likes ?? []).map((l) => l.comment_id));
    }

    const toView = (r: Row): CommentView => ({
      ...r,
      likedByMe: likedSet.has(r.id),
      replies: [],
    });

    const repliesByParent = new Map<string, CommentView[]>();
    for (const r of replyRows) {
      if (!r.parent_comment_id) continue;
      const list = repliesByParent.get(r.parent_comment_id) ?? [];
      list.push(toView(r));
      repliesByParent.set(r.parent_comment_id, list);
    }

    const comments = topRows.map((c) => ({
      ...toView(c),
      replies: repliesByParent.get(c.id) ?? [],
    }));

    return { comments, hasMore: topRows.length === limit };
  },
);

/**
 * Post a comment (top-level) or a 1-level reply (`parentCommentId` set). Inserts via the
 * user-session client — `author_id` defaults to auth.uid() (not grantable → no spoofing),
 * RLS gates published + own, and the depth trigger caps replies at 1 level. Returns the
 * new enriched comment.
 */
export async function postComment(
  workflowId: string,
  body: string,
  parentCommentId?: string | null,
): Promise<PostCommentResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  // Server-side trim/guard (the action is the trust boundary — a direct call bypasses
  // the composer's client-side trim; the DB CHECK counts whitespace).
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "db_error" };

  const { data, error } = await supabase
    .from("comments")
    .insert({
      workflow_id: workflowId,
      body: trimmed,
      parent_comment_id: parentCommentId ?? null,
    })
    .select(AUTHOR_SELECT)
    .single();
  if (error || !data) return { ok: false, error: "db_error" };

  const row = data as Row;
  return { ok: true, comment: { ...row, likedByMe: false, replies: [] } };
}

/**
 * Toggle the caller's like on a comment. Reads whether a `comment_likes` row exists, then
 * deletes (un-like) or inserts (like). The ±1 trigger maintains `comments.like_count` —
 * never written here. RLS gates own + published.
 */
export async function toggleCommentLike(
  commentId: string,
): Promise<ToggleLikeResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: existing } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("profile_id", user.id);
    if (error) return { ok: false, error: "db_error" };
    return { ok: true, liked: false };
  }

  // Idempotent like: ON CONFLICT DO NOTHING (ignoreDuplicates) so a concurrent
  // cross-tab double-like converges to one row instead of surfacing a PK 23505 as a
  // db_error that would wrongly revert a like that actually persisted.
  const { error } = await supabase
    .from("comment_likes")
    .upsert(
      { comment_id: commentId, profile_id: user.id },
      { onConflict: "comment_id,profile_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: "db_error" };
  return { ok: true, liked: true };
}

/**
 * Soft-delete the caller's OWN comment (owner flows) — sets `deleted_at` so the viewer shows the
 * "[comment removed]" tombstone and any replies survive (a hard DELETE would cascade them). RLS
 * (`comments_softdelete_own` + the deleted_at-only column grant) is the real boundary; the explicit
 * `author_id` filter just scopes the row. Idempotent: re-deleting an already-removed comment is fine.
 */
export async function softDeleteComment(
  commentId: string,
): Promise<DeleteCommentResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("author_id", user.id);
  if (error) return { ok: false, error: "db_error" };
  return { ok: true };
}
