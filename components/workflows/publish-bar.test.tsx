import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { PublishBar } from "./publish-bar";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(app)/workflows/actions", () => ({
  publishWorkflowAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function node(id: string, idx: number): WorkflowNode {
  return {
    id,
    workflow_id: "w1",
    idx,
    pos_x: 0,
    pos_y: 0,
    step_title: null,
    tool_name: "ChatGPT",
    tool_version: null,
    prompt: "p",
    purpose: "u",
    est_time: null,
    est_cost: null,
    notes: null,
    note_lang: null,
    tool_url: null,
    created_at: "2026-06-15T00:00:00.000Z",
    updated_at: "2026-06-15T00:00:00.000Z",
  };
}

const output: NodeOutputView = {
  kind: "text",
  thumbUrl: null,
} as NodeOutputView;

function publishButton() {
  return screen.getByRole("button", { name: /publish/i });
}

describe("PublishBar", () => {
  it("disables publish with 'Add a step' hint when there are zero nodes", () => {
    render(<PublishBar workflowId="w1" nodes={[]} outputsByNodeId={{}} />);
    expect(publishButton()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Add a step to publish")).toBeInTheDocument();
  });

  it("disables publish and counts the steps still missing an output", () => {
    render(
      <PublishBar
        workflowId="w1"
        nodes={[node("n1", 0), node("n2", 1)]}
        // only n1 is covered → 1 still missing
        outputsByNodeId={{ n1: output }}
      />,
    );
    expect(publishButton()).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText("1 step still needs a sample output"),
    ).toBeInTheDocument();
  });

  it("enables publish (no hint) once every node is covered", () => {
    render(
      <PublishBar
        workflowId="w1"
        nodes={[node("n1", 0), node("n2", 1)]}
        outputsByNodeId={{ n1: output, n2: output }}
      />,
    );
    expect(publishButton()).toHaveAttribute("aria-disabled", "false");
    expect(
      screen.queryByText(/still need a sample output/),
    ).not.toBeInTheDocument();
  });
});
