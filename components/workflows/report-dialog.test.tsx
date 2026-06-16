import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitReportAction } from "@/app/(app)/workflows/actions";
import { ReportDialog } from "./report-dialog";

vi.mock("@/app/(app)/workflows/actions", () => ({
  submitReportAction: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

import { toast } from "sonner";

const submitMock = vi.mocked(submitReportAction);
const toastMock = vi.mocked(toast);

const TARGET = "11111111-1111-1111-1111-111111111111";

function openDialog(onOpenChange = vi.fn()) {
  render(
    <ReportDialog
      targetType="workflow"
      targetId={TARGET}
      open={true}
      onOpenChange={onOpenChange}
    />,
  );
  return onOpenChange;
}

beforeEach(() => vi.clearAllMocks());

describe("ReportDialog", () => {
  it("renders the title + reasons; Submit is disabled until a reason is picked", () => {
    openDialog();
    expect(screen.getByText(/report this workflow/i)).toBeInTheDocument();
    expect(screen.getByText("Spam or self-promo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit report/i }),
    ).toBeDisabled();
  });

  it("submits the selected reason, confirms, and closes", async () => {
    submitMock.mockResolvedValueOnce({ ok: true });
    const onOpenChange = openDialog();
    fireEvent.click(screen.getByLabelText("Spam or self-promo"));
    fireEvent.click(screen.getByRole("button", { name: /submit report/i }));
    await waitFor(() =>
      expect(submitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: "workflow",
          targetId: TARGET,
          reason: "spam",
        }),
      ),
    );
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        "Reported. A moderator will review.",
      ),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("treats already-reported as a friendly soft-success", async () => {
    submitMock.mockResolvedValueOnce({ ok: true, duplicate: true });
    openDialog();
    fireEvent.click(screen.getByLabelText("Harassment"));
    fireEvent.click(screen.getByRole("button", { name: /submit report/i }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.stringMatching(/already reported/i),
      ),
    );
  });

  it("keeps the dialog open and toasts the error on failure", async () => {
    submitMock.mockResolvedValueOnce({
      ok: false,
      error: "Couldn't submit your report. Please try again.",
    });
    const onOpenChange = openDialog();
    fireEvent.click(screen.getByLabelText("Other"));
    fireEvent.click(screen.getByRole("button", { name: /submit report/i }));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        expect.stringMatching(/couldn't submit/i),
      ),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
