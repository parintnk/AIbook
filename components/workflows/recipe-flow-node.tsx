"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { createContext, type ReactNode, useContext } from "react";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { CanvasNode } from "@/lib/stores/canvas-store";
import { RecipeCard } from "./recipe-card";

type NodeActions = {
  onEdit: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
};

const NodeActionsContext = createContext<NodeActions | null>(null);

/**
 * Per-node sample outputs (Story 2.4), provided by the canvas so a flow node can
 * show its output indicator without putting the (refreshing, non-serializable-URL)
 * view into the serializable React Flow node data.
 */
const OutputsContext = createContext<Record<string, NodeOutputView>>({});

export function OutputsProvider({
  outputsByNodeId,
  children,
}: {
  outputsByNodeId: Record<string, NodeOutputView>;
  children: ReactNode;
}) {
  return (
    <OutputsContext.Provider value={outputsByNodeId}>
      {children}
    </OutputsContext.Provider>
  );
}

/**
 * Provided by the canvas so the flow node reaches stable edit/delete handlers
 * without storing non-serializable callbacks in the node data (the store stays
 * serializable; handlers don't go stale per render).
 */
export function NodeActionsProvider({
  actions,
  children,
}: {
  actions: NodeActions;
  children: ReactNode;
}) {
  return (
    <NodeActionsContext.Provider value={actions}>
      {children}
    </NodeActionsContext.Provider>
  );
}

// Override React Flow's default handle styling to match the mockup: 12px accent
// ring on a surface fill.
const HANDLE_CLASS =
  "!size-3 !border-2 !border-accent-foreground !bg-background";

/**
 * The React Flow custom node (Story 2.3 / AC2) — wraps the shared RecipeCard
 * (mode=editor) and adds left (target) + right (source) connection handles.
 * Selection is unified with React Flow's `selected`. The card body is the drag
 * surface; its details/actions carry `nodrag` so links + Edit/Delete still click.
 */
export function RecipeFlowNode({ data, selected }: NodeProps<CanvasNode>) {
  const actions = useContext(NodeActionsContext);
  const outputs = useContext(OutputsContext);
  const { node } = data;
  return (
    <div className="w-[280px]">
      <Handle
        type="target"
        position={Position.Left}
        className={HANDLE_CLASS}
        aria-label="Step input"
      />
      <RecipeCard
        node={node}
        output={outputs[node.id] ?? null}
        mode="editor"
        selected={selected}
        onEdit={() => actions?.onEdit(node.id)}
        onDelete={() => actions?.onDelete(node.id)}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={HANDLE_CLASS}
        aria-label="Step output"
      />
    </div>
  );
}
