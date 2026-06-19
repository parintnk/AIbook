"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { RecipeCard } from "./recipe-card";

/** Read-only flow node data: the step + its output, embedded (no editor store/context). */
export type ViewerFlowNode = Node<
  { node: WorkflowNode; output: NodeOutputView | null },
  "recipe"
>;

// Non-connectable handles still render so edges anchor; match the mockup's accent dot
// (11px, white fill, 2px accent ring, soft glow).
const HANDLE_CLASS =
  "!size-[11px] !border-2 !border-primary !bg-background !shadow-[0_0_8px_rgba(109,94,240,0.3)]";

/**
 * The public viewer's React Flow node (Story 3.1 / FR6) — wraps the shared
 * RecipeCard in `mode="viewer"` (single-click expands the full card) with
 * non-connectable handles. No NodeActions, no blocked/amber treatment (a published
 * workflow is complete by the 2.5 gate). The card owns its own expand state, so the
 * canvas leaves React Flow selection off.
 */
export function RecipeViewerNode({ data }: NodeProps<ViewerFlowNode>) {
  const { node, output } = data;
  return (
    <div className="w-[240px]">
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className={HANDLE_CLASS}
        aria-label="Step input"
      />
      <RecipeCard node={node} output={output} mode="viewer" />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className={HANDLE_CLASS}
        aria-label="Step output"
      />
    </div>
  );
}
