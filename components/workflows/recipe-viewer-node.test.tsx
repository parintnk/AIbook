import { fireEvent, render, screen } from "@testing-library/react";
import { type NodeProps, ReactFlowProvider } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { RecipeViewerNode, type ViewerFlowNode } from "./recipe-viewer-node";

const wf: WorkflowNode = {
  id: "n1",
  workflow_id: "w1",
  idx: 0,
  pos_x: 0,
  pos_y: 0,
  step_title: "Define brand direction",
  tool_name: "ChatGPT",
  tool_version: null,
  prompt: "a prompt",
  purpose: "why this step exists",
  est_time: null,
  est_cost: null,
  notes: null,
  note_lang: null,
  tool_url: null,
  created_at: "2026-06-14T00:00:00.000Z",
  updated_at: "2026-06-14T00:00:00.000Z",
};

const props = {
  id: "n1",
  type: "recipe",
  data: { node: wf, output: null },
  selected: false,
} as unknown as NodeProps<ViewerFlowNode>;

describe("RecipeViewerNode", () => {
  it("renders the shared RecipeCard (viewer) with connection handles", () => {
    const { container } = render(
      <ReactFlowProvider>
        <RecipeViewerNode {...props} />
      </ReactFlowProvider>,
    );
    expect(screen.getByText("ChatGPT")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // idx 0 → step 1
    // Collapsed by default — details hidden until clicked (viewer mode).
    expect(screen.queryByText(wf.purpose)).not.toBeInTheDocument();
    expect(
      container.querySelectorAll(".react-flow__handle").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("expands the full card on click (AC2) and shows NO editor chrome", () => {
    render(
      <ReactFlowProvider>
        <RecipeViewerNode {...props} />
      </ReactFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(wf.purpose)).toBeInTheDocument();
    // Viewer mode never renders Edit/Delete.
    expect(
      screen.queryByRole("button", { name: /edit|delete/i }),
    ).not.toBeInTheDocument();
  });
});
