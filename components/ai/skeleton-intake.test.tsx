import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateSkeletonAction = vi.fn();
const refresh = vi.fn();
vi.mock("@/app/(app)/workflows/actions", () => ({
  generateSkeletonAction: (...a: unknown[]) => generateSkeletonAction(...a),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SkeletonIntake } from "./skeleton-intake";

beforeEach(() => {
  generateSkeletonAction.mockReset();
  refresh.mockReset();
  generateSkeletonAction.mockResolvedValue({ success: true, nodeIds: ["n1"] });
});

describe("SkeletonIntake (Story 11.2)", () => {
  it("shows the rate-limited notice (not the form) when at the cap", () => {
    render(
      <SkeletonIntake
        workflowId="w1"
        professionName="Designer"
        usedToday={5}
      />,
    );
    expect(
      screen.getByText(
        "You've used today's 5 skeleton runs. Resets at midnight.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("one sentence…"),
    ).not.toBeInTheDocument();
  });

  it("submits the goal to the action", () => {
    render(
      <SkeletonIntake
        workflowId="w1"
        professionName="Designer"
        usedToday={0}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("one sentence…"), {
      target: { value: "a brand kit" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate skeleton/i }));
    expect(generateSkeletonAction).toHaveBeenCalledWith("w1", {
      goal: "a brand kit",
    });
  });

  it("shows the profession chip + the usage count", () => {
    render(
      <SkeletonIntake
        workflowId="w1"
        professionName="Graphic Designer"
        usedToday={2}
      />,
    );
    expect(
      screen.getByText(/Profession: Graphic Designer/),
    ).toBeInTheDocument();
    expect(screen.getByText("2/5 today")).toBeInTheDocument();
  });

  it("disables Generate with an empty goal", () => {
    render(
      <SkeletonIntake workflowId="w1" professionName={null} usedToday={0} />,
    );
    expect(
      screen.getByRole("button", { name: /generate skeleton/i }),
    ).toBeDisabled();
  });
});
