import { render, screen } from "@testing-library/react";
import { type NodeProps, ReactFlowProvider } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import type { CanvasNode } from "@/lib/stores/canvas-store";
import { RecipeFlowNode } from "./recipe-flow-node";

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
  purpose: "why",
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
  data: { node: wf },
  selected: false,
} as unknown as NodeProps<CanvasNode>;

describe("RecipeFlowNode", () => {
  it("renders the shared RecipeCard with connection handles", () => {
    const { container } = render(
      <ReactFlowProvider>
        <RecipeFlowNode {...props} />
      </ReactFlowProvider>,
    );
    // The shared recipe card renders as the node body.
    expect(screen.getByText("ChatGPT")).toBeInTheDocument();
    // Source + target connection handles.
    expect(
      container.querySelectorAll(".react-flow__handle").length,
    ).toBeGreaterThanOrEqual(2);
  });
});
