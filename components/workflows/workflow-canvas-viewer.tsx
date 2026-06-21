"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import { LayoutGrid, Search } from "lucide-react";
import { useMemo } from "react";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowEdge } from "@/lib/services/workflow-edges";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { RecipeViewerNode, type ViewerFlowNode } from "./recipe-viewer-node";

const nodeTypes = { recipe: RecipeViewerNode };
// Accent bezier edges with an arrowhead — direction shows step order (no numbers on the cards).
const defaultEdgeOptions = {
  style: { stroke: "var(--primary)", strokeWidth: 2.2, opacity: 0.85 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 26,
    height: 26,
    color: "var(--primary)",
  },
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
      <div className="relative h-[72vh] min-h-[560px] w-full overflow-hidden rounded-card bg-[#f7f9fd] ring-1 ring-foreground/10 dark:bg-transparent">
        {/* Accent glow pooling in the canvas (mockup `.rfglow`). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(620px 380px at 38% 32%, rgba(109,94,240,0.07), transparent 70%)",
          }}
        />
        {/* Canvas bar (mockup `.canvas-bar`) — pointer-events-none so pan/zoom passes through. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between border-foreground/[0.05] border-b bg-background/65 px-[17px] py-[13px] backdrop-blur-xl">
          <div className="flex items-center gap-2.5 font-semibold text-[13px] text-foreground">
            <LayoutGrid width={16} height={16} aria-hidden="true" />
            Workflow canvas
            <span className="rounded-full bg-accent px-2.5 py-1 font-semibold text-[11px] text-accent-foreground">
              {nodes.length} steps
            </span>
          </div>
          <div className="hidden items-center gap-2 text-[12px] text-muted-foreground sm:flex">
            <Search width={14} height={14} aria-hidden="true" />
            Drag to pan · scroll to zoom
          </div>
        </div>
        <ReactFlow
          // Uncontrolled (read-only viewer): React Flow owns the node/edge store so
          // the MiniMap (which reads `store.nodes`) actually paints the node rects.
          // Controlled `nodes` without `onNodesChange` left `store.nodes` unsynced →
          // an empty minimap. Nodes/outputs are static post-SSR, so default-* is safe.
          defaultNodes={rfNodes}
          defaultEdges={rfEdges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          // Viewers CAN drag cards to rearrange the canvas for their own reading —
          // it's purely local (uncontrolled store, no onNodesChange/persist), so a
          // refresh restores the author's saved layout. No connecting/deleting.
          nodesConnectable={false}
          // elementsSelectable stays ON so the card still gets its click (the card
          // owns click-to-expand, AC2); a drag moves, a plain click expands.
          elementsSelectable
          edgesFocusable={false}
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.1}
            color="rgba(128,128,150,0.18)"
          />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            bgColor="transparent"
            maskColor="rgba(120,120,140,0.14)"
            nodeColor="rgba(109,94,240,0.6)"
            nodeStrokeWidth={0}
            className="!rounded-[14px]"
          />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
