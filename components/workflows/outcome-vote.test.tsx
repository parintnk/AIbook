import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { castOutcomeVoteAction } from "@/app/(app)/workflows/actions";
import { OutcomeVote } from "./outcome-vote";

vi.mock("@/app/(app)/workflows/actions", () => ({
  castOutcomeVoteAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const action = vi.mocked(castOutcomeVoteAction);
const counts = { worked: 47, tweaked: 12, failed: 3 };

beforeEach(() => vi.clearAllMocks());

describe("OutcomeVote", () => {
  it("renders the four verdicts with their counts", () => {
    render(
      <OutcomeVote workflowId="w1" counts={counts} myVerdict={null} canVote />,
    );
    expect(screen.getByText(/tried & worked/i)).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByText(/worked with tweaks/i)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(/didn't work/i)).toBeInTheDocument();
    expect(screen.getByText(/haven't tried/i)).toBeInTheDocument();
  });

  it("marks my current verdict active", () => {
    render(
      <OutcomeVote
        workflowId="w1"
        counts={counts}
        myVerdict="worked"
        canVote
      />,
    );
    expect(
      screen.getByRole("button", { name: /tried & worked/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("optimistically increments the chosen verdict's count on click", async () => {
    action.mockResolvedValueOnce({ ok: true });
    render(
      <OutcomeVote workflowId="w1" counts={counts} myVerdict={null} canVote />,
    );
    fireEvent.click(screen.getByRole("button", { name: /didn't work/i }));
    // failed 3 → 4 immediately (optimistic).
    expect(screen.getByText("4")).toBeInTheDocument();
    await waitFor(() => expect(action).toHaveBeenCalledWith("w1", "failed"));
  });

  it("reverts + toasts on server error", async () => {
    action.mockResolvedValueOnce({ ok: false, error: "db_error" });
    render(
      <OutcomeVote workflowId="w1" counts={counts} myVerdict={null} canVote />,
    );
    fireEvent.click(screen.getByRole("button", { name: /didn't work/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    // reverted back to 3.
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not vote when signed out — shows a sign-in affordance", () => {
    render(
      <OutcomeVote
        workflowId="w1"
        counts={counts}
        myVerdict={null}
        canVote={false}
      />,
    );
    expect(screen.getByText(/sign in to vote/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/tried & worked/i));
    expect(action).not.toHaveBeenCalled();
  });
});
