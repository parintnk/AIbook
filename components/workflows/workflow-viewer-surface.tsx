"use client";

import dynamic from "next/dynamic";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowEdge } from "@/lib/services/workflow-edges";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";

// Canvas is client-only (React Flow can't SSR) — lazy so it stays out of the
// initial bundle. dynamic(ssr:false) must live in a client component, not the RSC
// page (mirrors workflow-editor-surface.tsx). This is also the seam Story 3.2
// extends with the List/Canvas toggle + linear step-list.
const WorkflowCanvasViewer = dynamic(
  () => import("./workflow-canvas-viewer").then((m) => m.WorkflowCanvasViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[70vh] items-center justify-center rounded-card text-muted-foreground text-sm ring-1 ring-foreground/10">
        Loading canvas…
      </div>
    ),
  },
);

/**
 * The viewer surface (Story 3.1). For now it just hosts the read-only canvas; Story
 * 3.2 turns this into the List/Canvas toggle (mobile defaults to the linear list).
 * `workflowId` is accepted for that forward-compat even though 3.1's canvas is
 * fully prop-driven.
 */
export function WorkflowViewerSurface({
  nodes,
  edges,
  outputsByNodeId,
}: {
  workflowId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  outputsByNodeId: Record<string, NodeOutputView>;
}) {
  return (
    <div className="mt-8">
      <WorkflowCanvasViewer
        nodes={nodes}
        edges={edges}
        outputsByNodeId={outputsByNodeId}
      />
    </div>
  );
}
