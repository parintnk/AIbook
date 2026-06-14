import { beforeEach, describe, expect, it } from "vitest";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { type CanvasNode, useCanvasStore } from "./canvas-store";

function node(id: string, idx: number): CanvasNode {
  const wf: WorkflowNode = {
    id,
    workflow_id: "w1",
    idx,
    pos_x: 0,
    pos_y: 0,
    step_title: null,
    tool_name: "ChatGPT",
    tool_version: null,
    prompt: "p",
    purpose: "why",
    est_time: null,
    est_cost: null,
    notes: null,
    note_lang: null,
    tool_url: null,
    created_at: "2026-06-14T00:00:00.000Z",
    updated_at: "2026-06-14T00:00:00.000Z",
  };
  return { id, type: "recipe", position: { x: 0, y: 0 }, data: { node: wf } };
}

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    selectedId: null,
    dirtyPositions: false,
  });
});

describe("useCanvasStore", () => {
  it("reset seeds nodes/edges and clears selection + dirty", () => {
    useCanvasStore.setState({ selectedId: "old", dirtyPositions: true });
    useCanvasStore
      .getState()
      .reset([node("n1", 0)], [{ id: "e1", source: "n1", target: "n2" }]);
    const s = useCanvasStore.getState();
    expect(s.nodes).toHaveLength(1);
    expect(s.edges).toHaveLength(1);
    expect(s.selectedId).toBeNull();
    expect(s.dirtyPositions).toBe(false);
  });

  it("setNodes / setEdges apply an updater immutably", () => {
    useCanvasStore.getState().reset([node("n1", 0)], []);
    const before = useCanvasStore.getState().nodes;
    useCanvasStore.getState().setNodes((ns) => [...ns, node("n2", 1)]);
    const after = useCanvasStore.getState().nodes;
    expect(after).toHaveLength(2);
    expect(after).not.toBe(before); // new array reference

    useCanvasStore
      .getState()
      .setEdges((es) => [...es, { id: "e1", source: "n1", target: "n2" }]);
    expect(useCanvasStore.getState().edges).toHaveLength(1);
  });

  it("setSelected updates the selected id", () => {
    useCanvasStore.getState().setSelected("n2");
    expect(useCanvasStore.getState().selectedId).toBe("n2");
  });

  it("marks and clears the positions-dirty flag", () => {
    useCanvasStore.getState().markPositionsDirty();
    expect(useCanvasStore.getState().dirtyPositions).toBe(true);
    useCanvasStore.getState().clearPositionsDirty();
    expect(useCanvasStore.getState().dirtyPositions).toBe(false);
  });
});
