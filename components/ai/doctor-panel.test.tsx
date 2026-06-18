import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DoctorReview } from "@/lib/ai";

const reviewWorkflowAction = vi.fn();
const setSelected = vi.fn();
vi.mock("@/app/(app)/workflows/actions", () => ({
  reviewWorkflowAction: (...a: unknown[]) => reviewWorkflowAction(...a),
}));
vi.mock("@/lib/stores/canvas-store", () => ({
  useCanvasStore: { getState: () => ({ setSelected }) },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { DoctorPanel } from "./doctor-panel";

const REVIEW: DoctorReview = {
  pass: 1,
  flag: 1,
  nodes: [
    {
      nodeId: "n1",
      idx: 0,
      stepTitle: "Define brief",
      status: "pass",
      flags: [],
    },
    {
      nodeId: "n2",
      idx: 1,
      stepTitle: "Refine",
      status: "flag",
      flags: [
        { check: "thin_context", message: "add detail." },
        {
          check: "missing_output",
          message: "add a sample to publish.",
          required: true,
        },
      ],
    },
  ],
};

beforeEach(() => {
  reviewWorkflowAction.mockReset();
  setSelected.mockReset();
  reviewWorkflowAction.mockResolvedValue({ ok: true, review: REVIEW });
});

describe("DoctorPanel (Story 11.3)", () => {
  it("renders the trigger + the advisory footer (before any review)", () => {
    render(<DoctorPanel workflowId="w1" usedToday={0} limit={10} />);
    expect(
      screen.getByRole("button", { name: /review before publish/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Advisory only/)).toBeInTheDocument();
    expect(screen.getByText("0/10 today")).toBeInTheDocument();
  });

  it("shows the rate-limited notice (not the trigger) when at the cap", () => {
    render(<DoctorPanel workflowId="w1" usedToday={10} limit={10} />);
    expect(
      screen.getByText(
        "You've used today's 10 Doctor runs. Resets at midnight.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /review before publish/i }),
    ).not.toBeInTheDocument();
    // the advisory footer still shows (advisory is permanent)
    expect(screen.getByText(/Advisory only/)).toBeInTheDocument();
  });

  it("runs the review → renders pass/flag rows + flag detail + the Jump link", async () => {
    render(<DoctorPanel workflowId="w1" usedToday={0} limit={10} />);
    fireEvent.click(
      screen.getByRole("button", { name: /review before publish/i }),
    );
    expect(reviewWorkflowAction).toHaveBeenCalledWith("w1");

    // Wait for the terminal state (transition settled → trigger re-labels for re-run).
    expect(
      await screen.findByRole("button", { name: /re-run review/i }),
    ).toBeInTheDocument();
    // pass row + flag row
    expect(screen.getByText(/Define brief/)).toBeInTheDocument();
    expect(screen.getByText(/Refine/)).toBeInTheDocument();
    // the score pills
    expect(screen.getByText("1 pass")).toBeInTheDocument();
    expect(screen.getByText("1 flag")).toBeInTheDocument();
    // flag labels: the AI check + the deterministic FR10 req-flag
    expect(screen.getByText("Step context is thin")).toBeInTheDocument();
    expect(screen.getByText("Missing required output")).toBeInTheDocument();
  });

  it("Jump to node selects the node on the canvas", async () => {
    render(<DoctorPanel workflowId="w1" usedToday={0} limit={10} />);
    fireEvent.click(
      screen.getByRole("button", { name: /review before publish/i }),
    );
    const jump = await screen.findByRole("button", {
      name: /jump to node 2/i,
    });
    fireEvent.click(jump);
    expect(setSelected).toHaveBeenCalledWith("n2");
  });
});
