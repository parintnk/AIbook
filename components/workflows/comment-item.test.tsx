import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentView } from "@/lib/services/comments";
import { CommentItem } from "./comment-item";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

function comment(over: Partial<CommentView> = {}): CommentView {
  const iso = new Date().toISOString();
  return {
    id: "c1",
    workflow_id: "w1",
    author_id: "a1",
    parent_comment_id: null,
    body: "A comment body",
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

beforeEach(() => vi.clearAllMocks());

describe("CommentItem", () => {
  it("shows the Author tag when the commenter is the workflow author", () => {
    render(
      <CommentItem
        comment={comment({ author_id: "wfAuthor" })}
        workflowAuthorId="wfAuthor"
        canInteract
        onToggleLike={vi.fn()}
        onReply={vi.fn()}
      />,
    );
    expect(screen.getByText("Author")).toBeInTheDocument();
  });

  it("hides the Author tag for a non-author", () => {
    render(
      <CommentItem
        comment={comment({ author_id: "someone" })}
        workflowAuthorId="wfAuthor"
        canInteract
        onToggleLike={vi.fn()}
        onReply={vi.fn()}
      />,
    );
    expect(screen.queryByText("Author")).not.toBeInTheDocument();
  });

  it("reflects likedByMe + count and fires onToggleLike", () => {
    const onLike = vi.fn();
    render(
      <CommentItem
        comment={comment({ id: "cx", like_count: 3, likedByMe: true })}
        workflowAuthorId="a"
        canInteract
        onToggleLike={onLike}
        onReply={vi.fn()}
      />,
    );
    const like = screen.getByRole("button", { name: /unlike comment/i });
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("3")).toBeInTheDocument();
    fireEvent.click(like);
    expect(onLike).toHaveBeenCalledWith("cx");
  });

  it("opens an inline reply box and submits a reply", () => {
    const onReply = vi.fn();
    render(
      <CommentItem
        comment={comment({ id: "cx" })}
        workflowAuthorId="a"
        canInteract
        onToggleLike={vi.fn()}
        onReply={onReply}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /reply/i }));
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: "my reply" },
    });
    fireEvent.click(screen.getByRole("button", { name: /post/i }));
    expect(onReply).toHaveBeenCalledWith("cx", "my reply");
  });

  it("renders a tombstone for a removed (soft-deleted) comment", () => {
    render(
      <CommentItem
        comment={comment({ deleted_at: new Date().toISOString() })}
        workflowAuthorId="a"
        canInteract
        onToggleLike={vi.fn()}
        onReply={vi.fn()}
      />,
    );
    expect(screen.getByText(/comment removed/i)).toBeInTheDocument();
  });

  it("renders a nested reply one level deep", () => {
    render(
      <CommentItem
        comment={comment({
          replies: [comment({ id: "r1", body: "A nested reply" })],
        })}
        workflowAuthorId="a"
        canInteract
        onToggleLike={vi.fn()}
        onReply={vi.fn()}
      />,
    );
    expect(screen.getByText("A nested reply")).toBeInTheDocument();
  });

  it("anon: the like button is disabled and there is no Reply button", () => {
    render(
      <CommentItem
        comment={comment()}
        workflowAuthorId="a"
        canInteract={false}
        onToggleLike={vi.fn()}
        onReply={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /like comment/i }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /reply/i }),
    ).not.toBeInTheDocument();
  });
});
