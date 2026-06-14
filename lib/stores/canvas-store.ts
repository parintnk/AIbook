import type { Edge, Node } from "@xyflow/react";
import { create } from "zustand";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";

/**
 * Canvas working state (Story 2.3, DR-5). React Flow drives this store; it is
 * decoupled from the RSC server data and seeded from props via `reset()` on mount
 * (+ on workflowId change). Single-editor-at-a-time, so a singleton store is fine
 * as long as it is reset-guarded. Components select narrowly (and use `useShallow`
 * for array selections) to avoid re-render storms.
 */

/** The serializable data each React Flow node carries (the recipe-card row). */
export type RecipeNodeData = { node: WorkflowNode };
export type CanvasNode = Node<RecipeNodeData, "recipe">;

type CanvasState = {
  nodes: CanvasNode[];
  edges: Edge[];
  selectedId: string | null;
  /** A drag happened → positions need an autosave flush. */
  dirtyPositions: boolean;
  setNodes: (updater: (nodes: CanvasNode[]) => CanvasNode[]) => void;
  setEdges: (updater: (edges: Edge[]) => Edge[]) => void;
  setSelected: (id: string | null) => void;
  markPositionsDirty: () => void;
  clearPositionsDirty: () => void;
  reset: (nodes: CanvasNode[], edges: Edge[]) => void;
};

export const useCanvasStore = create<CanvasState>()((set) => ({
  nodes: [],
  edges: [],
  selectedId: null,
  dirtyPositions: false,
  setNodes: (updater) => set((s) => ({ nodes: updater(s.nodes) })),
  setEdges: (updater) => set((s) => ({ edges: updater(s.edges) })),
  setSelected: (id) => set({ selectedId: id }),
  markPositionsDirty: () => set({ dirtyPositions: true }),
  clearPositionsDirty: () => set({ dirtyPositions: false }),
  reset: (nodes, edges) =>
    set({ nodes, edges, selectedId: null, dirtyPositions: false }),
}));
