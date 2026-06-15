"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import { useMemo } from "react";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowEdge } from "@/lib/services/workflow-edges";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { RecipeViewerNode, type ViewerFlowNode } from "./recipe-viewer-node";

const nodeTypes = { recipe: RecipeViewerNode };
// Accent-tinted bezier edges to match the mockup (no splice "+", static).
const defaultEdgeOptions = {
  style: { stroke: "var(--accent-foreground)", strokeWidth: 1.5 },
} as const;

/**
 * The read-only React Flow viewer (Story 3.1 / FR6 / AC1). A lean, static canvas —
 * NOT the editor canvas (no Zustand store, autosave, actions, sheets, or splice).
 * Nodes are non-draggable / non-connectable / non-selectable; pan + zoom + fit +
 * minimap remain. The recipe cards drive their own click-to-expand (AC2).
 */
export function WorkflowCanvasViewer({
  nodes,
  edges,
  outputsByNodeId,
}: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  outputsByNodeId: Record<string, NodeOutputView>;
}) {
  const rfNodes = useMemo<ViewerFlowNode[]>(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "recipe",
        position: { x: n.pos_x, y: n.pos_y },
        data: { node: n, output: outputsByNodeId[n.id] ?? null },
        draggable: false,
      })),
    [nodes, outputsByNodeId],
  );
  const rfEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.source_node_id,
        target: e.target_node_id,
      })),
    [edges],
  );

  return (
    <ReactFlowProvider>
      <div className="relative h-[70vh] w-full overflow-hidden rounded-card ring-1 ring-foreground/10">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          nodesDraggable={false}
          nodesConnectable={false}
          // elementsSelectable stays ON: with BOTH it and draggable off, React Flow
          // drops pointer-events on nodes and the pane eats the click — the card
          // needs the click for its viewer expand (AC2). The card shows no selection
          // chrome in viewer mode, so RF selection is visually inert.
          elementsSelectable
          edgesFocusable={false}
          deleteKeyCode={null}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
