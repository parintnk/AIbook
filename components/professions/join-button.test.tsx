import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  joinProfessionAction,
  leaveProfessionAction,
} from "@/app/(app)/communities/[slug]/actions";
import { JoinButton } from "./join-button";

vi.mock("@/app/(app)/communities/[slug]/actions", () => ({
  joinProfessionAction: vi.fn(),
  leaveProfessionAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const join = vi.mocked(joinProfessionAction);
const leave = vi.mocked(leaveProfessionAction);
const base = { professionId: "p1", professionSlug: "web-developer" };

beforeEach(() => vi.clearAllMocks());

describe("JoinButton", () => {
  it("renders a sign-in link for an anon visitor (no action call)", () => {
    render(
      <JoinButton {...base} initialJoined={false} isAuthed={false} canLeave />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/sign-in?next=/communities/web-developer",
    );
    expect(join).not.toHaveBeenCalled();
  });

  it("joins optimistically and calls the action", async () => {
    join.mockResolvedValueOnce({ ok: true });
    render(<JoinButton {...base} initialJoined={false} isAuthed canLeave />);
    fireEvent.click(screen.getByRole("button", { name: /join/i }));
    // Optimistic flip happens before the action resolves.
    expect(screen.getByRole("button", { name: /joined/i })).toBeInTheDocument();
    await waitFor(() => expect(join).toHaveBeenCalledWith("p1"));
  });

  it("reverts + toasts when the join fails", async () => {
    join.mockResolvedValueOnce({ ok: false, error: "Couldn't join." });
    render(<JoinButton {...base} initialJoined={false} isAuthed canLeave />);
    fireEvent.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't join."),
    );
    expect(screen.getByRole("button", { name: /join/i })).toBeInTheDocument();
  });

  it("leaves when already joined", async () => {
    leave.mockResolvedValueOnce({ ok: true });
    render(<JoinButton {...base} initialJoined isAuthed canLeave />);
    fireEvent.click(screen.getByRole("button", { name: /joined/i }));
    await waitFor(() => expect(leave).toHaveBeenCalledWith("p1"));
  });

  it("disables leaving for a moderator (joined but cannot leave)", () => {
    render(<JoinButton {...base} initialJoined isAuthed canLeave={false} />);
    expect(screen.getByRole("button", { name: /joined/i })).toBeDisabled();
  });
});
