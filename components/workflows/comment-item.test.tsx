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

// Default props for the new currentUserId/onDelete contract; override per test.
function renderItem(props: Partial<React.ComponentProps<typeof CommentItem>>) {
  return render(
    <CommentItem
      comment={comment()}
      workflowAuthorId="a"
      currentUserId={null}
      canInteract
      onToggleLike={vi.fn()}
      onReply={vi.fn()}
      onDelete={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("CommentItem", () => {
  it("shows the Author tag when the commenter is the workflow author", () => {
    renderItem({
      comment: comment({ author_id: "wfAuthor" }),
      workflowAuthorId: "wfAuthor",
    });
    expect(screen.getByText("Author")).toBeInTheDocument();
  });

  it("hides the Author tag for a non-author", () => {
    renderItem({
      comment: comment({ author_id: "someone" }),
      workflowAuthorId: "wfAuthor",
    });
    expect(screen.queryByText("Author")).not.toBeInTheDocument();
  });

  it("reflects likedByMe + count and fires onToggleLike", () => {
    const onLike = vi.fn();
    renderItem({
      comment: comment({ id: "cx", like_count: 3, likedByMe: true }),
      onToggleLike: onLike,
    });
    const like = screen.getByRole("button", { name: /unlike comment/i });
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("3")).toBeInTheDocument();
    fireEvent.click(like);
    expect(onLike).toHaveBeenCalledWith("cx");
  });

  it("opens an inline reply box and submits a reply", () => {
    const onReply = vi.fn();
    renderItem({ comment: comment({ id: "cx" }), onReply });
    fireEvent.click(screen.getByRole("button", { name: /reply/i }));
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: "my reply" },
    });
    fireEvent.click(screen.getByRole("button", { name: /post/i }));
    expect(onReply).toHaveBeenCalledWith("cx", "my reply");
  });

  it("renders a tombstone for a removed (soft-deleted) comment", () => {
    renderItem({ comment: comment({ deleted_at: new Date().toISOString() }) });
    expect(screen.getByText(/comment removed/i)).toBeInTheDocument();
  });

  it("renders a nested reply one level deep", () => {
    renderItem({
      comment: comment({
        replies: [comment({ id: "r1", body: "A nested reply" })],
      }),
    });
    expect(screen.getByText("A nested reply")).toBeInTheDocument();
  });

  it("anon: the like button is disabled and there is no Reply button", () => {
    renderItem({ canInteract: false });
    expect(
      screen.getByRole("button", { name: /like comment/i }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /reply/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Delete only on my own comment and fires onDelete after confirm", () => {
    const onDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderItem({
      comment: comment({ id: "mine", author_id: "me" }),
      currentUserId: "me",
      onDelete,
    });
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith("mine");
    confirmSpy.mockRestore();
  });

  it("hides Delete on someone else's comment", () => {
    renderItem({
      comment: comment({ author_id: "other" }),
      currentUserId: "me",
    });
    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
  });
});
