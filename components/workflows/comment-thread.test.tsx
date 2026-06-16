import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadMoreCommentsAction,
  postCommentAction,
} from "@/app/(app)/workflows/actions";
import type { CommentView } from "@/lib/services/comments";
import { CommentThread } from "./comment-thread";

vi.mock("@/app/(app)/workflows/actions", () => ({
  postCommentAction: vi.fn(),
  toggleCommentLikeAction: vi.fn(),
  loadMoreCommentsAction: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

const postMock = vi.mocked(postCommentAction);
const loadMock = vi.mocked(loadMoreCommentsAction);

function comment(over: Partial<CommentView> = {}): CommentView {
  const iso = new Date().toISOString();
  return {
    id: "c1",
    workflow_id: "w1",
    author_id: "a1",
    parent_comment_id: null,
    body: "Existing comment",
    like_count: 0,
    deleted_at: null,
    created_at: iso,
    updated_at: iso,
    author: { handle: "nina", display_name: "Nina", avatar_url: null },
    likedByMe: false,
    replies: [],
    ...over,
  };
}
const ME = { id: "me", handle: "me", displayName: "Me", avatarUrl: null };

beforeEach(() => vi.clearAllMocks());

describe("CommentThread", () => {
  it("renders the heading, composer, and existing comments", () => {
    render(
      <CommentThread
        workflowId="w1"
        workflowAuthorId="a1"
        initialComments={[comment()]}
        initialHasMore={false}
        total={1}
        currentUser={ME}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /comments/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Existing comment")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/share what worked/i),
    ).toBeInTheDocument();
  });

  it("anon sees 'Sign in to comment' and no composer textarea", () => {
    render(
      <CommentThread
        workflowId="w1"
        workflowAuthorId="a1"
        initialComments={[comment()]}
        initialHasMore={false}
        total={1}
        currentUser={null}
      />,
    );
    expect(screen.getByText(/sign in to comment/i)).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/share what worked/i),
    ).not.toBeInTheDocument();
  });

  it("optimistically posts a top-level comment", async () => {
    postMock.mockResolvedValueOnce({
      ok: true,
      comment: comment({ id: "real", body: "My new comment" }),
    });
    render(
      <CommentThread
        workflowId="w1"
        workflowAuthorId="a1"
        initialComments={[]}
        initialHasMore={false}
        total={0}
        currentUser={ME}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/share what worked/i), {
      target: { value: "My new comment" },
    });
    fireEvent.click(screen.getByRole("button", { name: /post/i }));
    expect(screen.getByText("My new comment")).toBeInTheDocument(); // optimistic
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("w1", "My new comment", null),
    );
  });

  it("shows 'Load more' and appends the next page, then 'caught up'", async () => {
    loadMock.mockResolvedValueOnce({
      comments: [comment({ id: "c2", body: "Loaded comment" })],
      hasMore: false,
    });
    render(
      <CommentThread
        workflowId="w1"
        workflowAuthorId="a1"
        initialComments={[comment()]}
        initialHasMore={true}
        total={2}
        currentUser={ME}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    await waitFor(() =>
      expect(screen.getByText("Loaded comment")).toBeInTheDocument(),
    );
    expect(loadMock).toHaveBeenCalledWith("w1", "top", 1);
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it("changing the sort re-fetches with the new sort", async () => {
    loadMock.mockResolvedValueOnce({ comments: [comment()], hasMore: false });
    render(
      <CommentThread
        workflowId="w1"
        workflowAuthorId="a1"
        initialComments={[comment()]}
        initialHasMore={false}
        total={1}
        currentUser={ME}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /newest/i }));
    await waitFor(() => expect(loadMock).toHaveBeenCalledWith("w1", "new", 0));
  });

  it("renders the empty state with no comments", () => {
    render(
      <CommentThread
        workflowId="w1"
        workflowAuthorId="a1"
        initialComments={[]}
        initialHasMore={false}
        total={0}
        currentUser={ME}
      />,
    );
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
  });
});
