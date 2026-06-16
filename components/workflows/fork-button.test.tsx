import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { forkWorkflowAction } from "@/app/(app)/workflows/actions";
import { ForkButton } from "./fork-button";

vi.mock("@/app/(app)/workflows/actions", () => ({
  forkWorkflowAction: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { toast } from "sonner";

const forkMock = vi.mocked(forkWorkflowAction);
const toastMock = vi.mocked(toast);

beforeEach(() => vi.clearAllMocks());

describe("ForkButton", () => {
  it("signed-out renders a 'Sign in to fork' link and never calls the action", () => {
    render(<ForkButton workflowId="w1" signedIn={false} />);
    const link = screen.getByRole("link", { name: /sign in to fork/i });
    expect(link).toHaveAttribute("href", "/sign-in?next=/workflows/w1");
    expect(forkMock).not.toHaveBeenCalled();
  });

  it("forks, toasts 'Forked. Editing your copy.', and navigates into the editor", async () => {
    forkMock.mockResolvedValueOnce({ ok: true, forkId: "fork-9" });
    render(<ForkButton workflowId="w1" signedIn={true} />);
    fireEvent.click(screen.getByRole("button", { name: /^fork$/i }));
    await waitFor(() => expect(forkMock).toHaveBeenCalledWith("w1"));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith("Forked. Editing your copy."),
    );
    expect(pushMock).toHaveBeenCalledWith("/workflows/fork-9/edit");
  });

  it("toasts the error and does NOT navigate on failure", async () => {
    forkMock.mockResolvedValueOnce({
      ok: false,
      error: "That workflow can't be forked.",
    });
    render(<ForkButton workflowId="w1" signedIn={true} />);
    fireEvent.click(screen.getByRole("button", { name: /^fork$/i }));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        expect.stringMatching(/can't be forked/i),
      ),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
