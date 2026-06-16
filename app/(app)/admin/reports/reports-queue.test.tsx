import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportView } from "@/lib/services/reports";
import { removeCommentAction, resolveReportAction } from "./actions";
import { ReportsQueue } from "./reports-queue";

vi.mock("./actions", () => ({
  resolveReportAction: vi.fn(),
  removeCommentAction: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

const resolveMock = vi.mocked(resolveReportAction);
const removeMock = vi.mocked(removeCommentAction);

function report(over: Partial<ReportView> = {}): ReportView {
  const iso = new Date().toISOString();
  return {
    id: "r1",
    reporter_id: "u1",
    target_type: "workflow",
    target_id: "w1",
    profession_id: "p1",
    reason: "spam",
    detail: null,
    status: "open",
    resolved_by: null,
    resolution: null,
    resolved_at: null,
    created_at: iso,
    reporter: { handle: "nina", display_name: null, avatar_url: null },
    targetTitle: "A workflow",
    targetPreview: null,
    professionName: "Marketer",
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("ReportsQueue", () => {
  it("renders an open report with its reason label, target, and reporter", () => {
    render(<ReportsQueue reports={[report()]} />);
    expect(screen.getByText("Spam or self-promo")).toBeInTheDocument();
    expect(screen.getByText("A workflow")).toBeInTheDocument();
    expect(screen.getByText(/reported by @nina/i)).toBeInTheDocument();
  });

  it("Resolve sends the moderator's note and removes the report optimistically", async () => {
    resolveMock.mockResolvedValueOnce({ ok: true });
    render(<ReportsQueue reports={[report({ id: "r1" })]} />);
    fireEvent.change(screen.getByLabelText(/resolution note/i), {
      target: { value: "Not a violation" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^resolve$/i }));
    await waitFor(() =>
      expect(resolveMock).toHaveBeenCalledWith("r1", "Not a violation"),
    );
    expect(screen.queryByText("A workflow")).not.toBeInTheDocument();
  });

  it("shows 'Remove comment' for a comment target and calls removeCommentAction", async () => {
    removeMock.mockResolvedValueOnce({ ok: true });
    render(
      <ReportsQueue
        reports={[
          report({
            id: "r2",
            target_type: "comment",
            target_id: "c1",
            targetTitle: "Host workflow",
            targetPreview: "bad words",
          }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /remove comment/i }));
    await waitFor(() =>
      expect(removeMock).toHaveBeenCalledWith("c1", undefined),
    );
  });

  it("renders the empty state when there are no open reports", () => {
    render(<ReportsQueue reports={[]} />);
    expect(screen.getByText(/no open reports/i)).toBeInTheDocument();
  });
});
