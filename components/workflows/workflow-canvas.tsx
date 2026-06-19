"use client";

import "@xyflow/react/dist/style.css";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  BaseEdge,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  MiniMap,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  createEdgeAction,
  deleteEdgeAction,
  deleteNodeAction,
  updateNodePositionsAction,
} from "@/app/(app)/workflows/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowEdge } from "@/lib/services/workflow-edges";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { type CanvasNode, useCanvasStore } from "@/lib/stores/canvas-store";
import type { WorkflowNodeValues } from "@/lib/validation/workflow";
import { NodeForm } from "./node-form";
import {
  NodeActionsProvider,
  OutputsProvider,
  RecipeFlowNode,
} from "./recipe-flow-node";

// ── DB ⇆ React Flow mappers ─────────────────────────────────────────────────
function toCanvasNodes(nodes: WorkflowNode[]): CanvasNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: "recipe",
    position: { x: n.pos_x, y: n.pos_y },
    data: { node: n },
  }));
}
function toFlowEdges(edges: WorkflowEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    type: "connector",
  }));
}

// ── Connector edge with an inline "+" splice button (AC1) ────────────────────
const SpliceContext = createContext<((edge: Edge) => void) | null>(null);

// The set of blocked (missing sample output) node ids (Story 2.5). A connector
// leading INTO a blocked step is drawn amber + dashed to match the mockup.
const BlockedNodesContext = createContext<Set<string>>(new Set());

function ConnectorEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}: EdgeProps) {
  const onSplice = useContext(SpliceContext);
  const blockedNodes = useContext(BlockedNodesContext);
  const targetBlocked = blockedNodes.has(target);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={
          targetBlocked
            ? { stroke: "var(--warning)", strokeDasharray: "6 5" }
            : undefined
        }
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          // nopan/nodrag so the button works over the canvas surface.
          className="nodrag nopan absolute flex size-6 items-center justify-center rounded-full border border-accent-foreground/30 bg-background text-accent-foreground shadow-sm transition hover:scale-110 hover:bg-accent"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          aria-label="Insert a step on this connector"
          onClick={() => onSplice?.({ id, source, target } as Edge)}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { recipe: RecipeFlowNode };
const edgeTypes = { connector: ConnectorEdge };

type Editing =
  | { mode: "new" }
  | { mode: "edit"; node: WorkflowNode }
  | { mode: "splice"; edge: Edge }
  | null;

/** Map a stored node to the form's string values (nulls → ""). */
function nodeToValues(node: WorkflowNode): WorkflowNodeValues {
  return {
    step_title: node.step_title ?? "",
    tool_name: node.tool_name,
    tool_version: node.tool_version ?? "",
    est_time: node.est_time ?? "",
    prompt: node.prompt,
    purpose: node.purpose,
    est_cost: node.est_cost ?? "",
    tool_url: node.tool_url ?? "",
    notes: node.notes ?? "",
    note_lang: node.note_lang ?? "",
  };
}

function CanvasInner({
  workflowId,
  nodes: propNodes,
  edges: propEdges,
  outputsByNodeId,
}: {
  workflowId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  outputsByNodeId: Record<string, NodeOutputView>;
}) {
  const router = useRouter();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const reset = useCanvasStore((s) => s.reset);
  const [editing, setEditing] = useState<Editing>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed (+ re-seed) the store from server data. The key changes only on a
  // structural/content change (id / idx / updated_at / edge set), NOT on a bare
  // position drag — so an in-flight drag is never clobbered.
  const dataKey = useMemo(
    () =>
      `${propNodes
        .map((n) => `${n.id}:${n.idx}:${n.updated_at}`)
        .join("|")}::${propEdges.map((e) => e.id).join("|")}`,
    [propNodes, propEdges],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-seed only when the server data signature changes, not on every mapper identity.
  useEffect(() => {
    reset(toCanvasNodes(propNodes), toFlowEdges(propEdges));
  }, [dataKey, reset]);

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) =>
      setNodes((ns) => applyNodeChanges(changes, ns)),
    [setNodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((es) => applyEdgeChanges(changes, es)),
    [setEdges],
  );

  // Flush any pending (debounced) position save NOW. Called before every structural
  // op (which router.refresh() → re-seeds from server) so a just-dragged position is
  // persisted first and not clobbered by the re-seed, and on unmount (List toggle).
  const flushPositions = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!useCanvasStore.getState().dirtyPositions) return;
    const positions = useCanvasStore.getState().nodes.map((n) => ({
      id: n.id,
      pos_x: n.position.x,
      pos_y: n.position.y,
    }));
    useCanvasStore.getState().clearPositionsDirty();
    const r = await updateNodePositionsAction(workflowId, positions);
    if (r?.error) toast.error(r.error);
  }, [workflowId]);

  // Flush pending positions when the canvas unmounts (e.g. switching to List).
  useEffect(() => {
    return () => {
      void flushPositions();
    };
  }, [flushPositions]);

  // Connect two nodes (AC2). Optimistic, then persist; refresh reconciles ids.
  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target) return;
      setEdges((es) => addEdge({ ...connection, type: "connector" }, es));
      void (async () => {
        await flushPositions();
        const r = await createEdgeAction(workflowId, source, target);
        if (r?.error) toast.error(r.error);
        router.refresh();
      })();
    },
    [workflowId, setEdges, router, flushPositions],
  );

  // Persist positions after a drag settles (debounced; AC3).
  const onNodeDragStop = useCallback(() => {
    useCanvasStore.getState().markPositionsDirty();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void flushPositions();
    }, 800);
  }, [flushPositions]);

  // Delete: every node carries required content (tool/prompt/purpose), so deleting
  // a node always confirms (AC3); edge-only deletes don't.
  const onBeforeDelete = useCallback(
    async ({ nodes: toDelete }: { nodes: CanvasNode[]; edges: Edge[] }) => {
      if (
        toDelete.length > 0 &&
        !window.confirm("Delete this step? This can't be undone.")
      )
        return false;
      return true;
    },
    [],
  );
  const onNodesDelete = useCallback(
    (deleted: CanvasNode[]) => {
      void (async () => {
        await flushPositions();
        const results = await Promise.all(
          deleted.map((n) => deleteNodeAction(workflowId, n.id)),
        );
        const err = results.find((r) => r?.error)?.error;
        if (err) toast.error(err);
        router.refresh();
      })();
    },
    [workflowId, router, flushPositions],
  );
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      void (async () => {
        const results = await Promise.all(
          deleted.map((e) => deleteEdgeAction(workflowId, e.id)),
        );
        const err = results.find((r) => r?.error)?.error;
        if (err) toast.error(err);
        router.refresh();
      })();
    },
    [workflowId, router],
  );

  // The blocked node ids (missing a sample output), for the amber edge treatment.
  const blockedNodes = useMemo(
    () =>
      new Set(propNodes.filter((n) => !outputsByNodeId[n.id]).map((n) => n.id)),
    [propNodes, outputsByNodeId],
  );

  // The id of the current chain tail (highest idx) — new "Add step" nodes chain off it.
  const tailNodeId = useMemo(() => {
    if (propNodes.length === 0) return null;
    return propNodes.reduce((a, b) => (a.idx >= b.idx ? a : b)).id;
  }, [propNodes]);

  // After NodeForm creates a node: chain (append) or splice, then refresh to truth.
  // The multi-step splice isn't one transaction; on partial failure we surface it +
  // refresh so the user sees the real graph (a single atomic splice RPC is deferred).
  async function onCreated(newNodeId: string | undefined, mode: Editing) {
    await flushPositions();
    if (newNodeId && mode) {
      let err: string | undefined;
      if (mode.mode === "new" && tailNodeId) {
        err = (await createEdgeAction(workflowId, tailNodeId, newNodeId)).error;
      } else if (mode.mode === "splice") {
        const d = await deleteEdgeAction(workflowId, mode.edge.id);
        const a = await createEdgeAction(
          workflowId,
          mode.edge.source,
          newNodeId,
        );
        const b = await createEdgeAction(
          workflowId,
          newNodeId,
          mode.edge.target,
        );
        err = d.error ?? a.error ?? b.error;
      }
      if (err) toast.error(`Step added, but linking it failed: ${err}`);
    }
    router.refresh();
  }

  const nodeActions = useMemo(
    () => ({
      onEdit: (nodeId: string) => {
        const found = propNodes.find((n) => n.id === nodeId);
        if (found) setEditing({ mode: "edit", node: found });
      },
      onDelete: (nodeId: string) => {
        if (!window.confirm("Delete this step? This can't be undone.")) return;
        void (async () => {
          await flushPositions();
          const r = await deleteNodeAction(workflowId, nodeId);
          if (r?.error) toast.error(r.error);
          router.refresh();
        })();
      },
    }),
    [propNodes, workflowId, router, flushPositions],
  );

  const editingMode = editing;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: double-click the empty canvas pane is a mouse-only add shortcut (AC1); the keyboard path is the "+ Add step" button
    <div
      className="relative h-[72vh] min-h-[560px] w-full overflow-hidden rounded-card bg-[#f7f9fd] ring-1 ring-foreground/10 dark:bg-transparent"
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).classList.contains("react-flow__pane"))
          setEditing({ mode: "new" });
      }}
    >
      <div className="absolute top-3 left-3 z-10">
        <Button
          type="button"
          size="sm"
          onClick={() => setEditing({ mode: "new" })}
        >
          + Add step
        </Button>
      </div>
      <SpliceContext.Provider
        value={(edge) => setEditing({ mode: "splice", edge })}
      >
        <BlockedNodesContext.Provider value={blockedNodes}>
          <OutputsProvider outputsByNodeId={outputsByNodeId}>
            <NodeActionsProvider actions={nodeActions}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDragStop={onNodeDragStop}
                onBeforeDelete={onBeforeDelete}
                onNodesDelete={onNodesDelete}
                onEdgesDelete={onEdgesDelete}
                zoomOnDoubleClick={false}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={24}
                  size={1.1}
                  color="rgba(128,128,150,0.18)"
                />
                <Controls />
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
            </NodeActionsProvider>
          </OutputsProvider>
        </BlockedNodesContext.Provider>
      </SpliceContext.Provider>

      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editing?.mode === "edit" ? "Edit step" : "Add step"}
            </SheetTitle>
            <SheetDescription>
              {editing?.mode === "edit"
                ? "Update this recipe card."
                : editing?.mode === "splice"
                  ? "Insert a step on this connector."
                  : "Add a tool + prompt step to your workflow."}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {editing ? (
              <NodeForm
                key={editing.mode === "edit" ? editing.node.id : editing.mode}
                workflowId={workflowId}
                nodeId={editing.mode === "edit" ? editing.node.id : undefined}
                defaultValues={
                  editing.mode === "edit"
                    ? nodeToValues(editing.node)
                    : undefined
                }
                output={
                  editing.mode === "edit"
                    ? (outputsByNodeId[editing.node.id] ?? null)
                    : null
                }
                onDone={(newNodeId) => {
                  const mode = editingMode;
                  setEditing(null);
                  if (mode?.mode === "edit") router.refresh();
                  else void onCreated(newNodeId, mode);
                }}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * The React Flow authoring canvas (Story 2.3). Wrapped in ReactFlowProvider so
 * fitView + the instance store work. Reuses the shared RecipeCard as the node.
 */
export function WorkflowCanvas(props: {
  workflowId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  outputsByNodeId: Record<string, NodeOutputView>;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
