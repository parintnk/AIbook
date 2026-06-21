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
  MarkerType,
  MiniMap,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import {
  LayoutGrid,
  Maximize2,
  MessageSquarePlus,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
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
  reindexNodesByTopologyAction,
  updateNodePositionsAction,
} from "@/app/(app)/workflows/actions";
import { SkeletonIntake } from "@/components/ai/skeleton-intake";
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
// Direction (= step order) is shown by a bold arrowhead on each connector — no step numbers.
// Amber/gold when the target step is still missing its sample output (blocked), accent otherwise;
// the arrow matches its line colour so it reads as one prominent connector.
const EDGE_ACCENT = "#6d5ef0";
const EDGE_BLOCKED = "#d97706";
function edgeMarker(blocked: boolean) {
  return {
    type: MarkerType.ArrowClosed,
    width: 26,
    height: 26,
    color: blocked ? EDGE_BLOCKED : EDGE_ACCENT,
  } as const;
}

function toFlowEdges(edges: WorkflowEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    type: "connector",
    markerEnd: edgeMarker(false),
  }));
}

// ── Connector edge with an inline "+" splice button (AC1) ────────────────────
const SpliceContext = createContext<((edge: Edge) => void) | null>(null);
// Remove a connector (disconnect two steps). The capability already existed via select-edge +
// Delete key, but had no visible affordance — this context drives the inline "×" button.
const RemoveEdgeContext = createContext<((edge: Edge) => void) | null>(null);

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
  const onRemove = useContext(RemoveEdgeContext);
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
            ? { stroke: EDGE_BLOCKED, strokeWidth: 2, strokeDasharray: "6 5" }
            : { stroke: EDGE_ACCENT, strokeWidth: 2 }
        }
      />
      <EdgeLabelRenderer>
        <div
          // nopan/nodrag so the buttons work over the canvas surface.
          className="nodrag nopan absolute flex items-center gap-1.5"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-full border border-accent-foreground/30 bg-background text-accent-foreground shadow-sm transition hover:scale-110 hover:bg-accent"
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
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition hover:scale-110 hover:border-destructive/40 hover:text-destructive"
            aria-label="Disconnect these steps"
            onClick={() => onRemove?.({ id, source, target } as Edge)}
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
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
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

// ── Left tool rail button (mockup `.toolbtn`) ────────────────────────────────
function RailButton({
  icon,
  label,
  onClick,
  accent,
  active,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  accent?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  const tone = accent
    ? "border-transparent bg-gradient-to-br from-[#7c6bff] to-[#6d5ef0] text-white shadow-[0_8px_20px_rgba(109,94,240,0.35)] hover:brightness-110"
    : active
      ? "border-primary/40 bg-primary/15 text-primary"
      : "border-border bg-foreground/[0.03] text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={`group/rail relative flex size-[42px] items-center justify-center rounded-[13px] border transition disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-foreground/[0.03] disabled:hover:text-muted-foreground ${tone}`}
    >
      {icon}
      {/* hover label chip (mockup `.lbl`) — to the right of the rail */}
      <span className="pointer-events-none absolute left-[calc(100%+11px)] z-50 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 font-medium text-foreground text-xs opacity-0 shadow-lg backdrop-blur-xl transition group-hover/rail:opacity-100">
        {label}
      </span>
    </button>
  );
}

function CanvasInner({
  workflowId,
  nodes: propNodes,
  edges: propEdges,
  outputsByNodeId,
  professionName,
  skeletonUsedToday,
}: {
  workflowId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  outputsByNodeId: Record<string, NodeOutputView>;
  professionName: string | null;
  skeletonUsedToday: number;
}) {
  const router = useRouter();
  const { fitView } = useReactFlow();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const reset = useCanvasStore((s) => s.reset);
  const [editing, setEditing] = useState<Editing>(null);
  // AI Skeleton intake inset (mockup bottom-left popover). Open by default on an
  // empty draft (the helper that seeds a first chain); toggled from the rail after.
  const [showSkeleton, setShowSkeleton] = useState(propNodes.length === 0);
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

  // Connect two nodes (AC2). Optimistic, then persist + re-number steps to follow the new chain.
  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target) return;
      setEdges((es) =>
        addEdge(
          { ...connection, type: "connector", markerEnd: edgeMarker(false) },
          es,
        ),
      );
      void (async () => {
        await flushPositions();
        const r = await createEdgeAction(workflowId, source, target);
        if (r?.error) toast.error(r.error);
        else await reindexNodesByTopologyAction(workflowId);
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
  // The inline "×" on a connector — optimistic remove, then persist (mirrors onEdgesDelete,
  // which the Delete key still triggers). No confirm: an edge carries no content.
  const removeEdge = useCallback(
    (edge: Edge) => {
      setEdges((es) => es.filter((e) => e.id !== edge.id));
      void (async () => {
        const r = await deleteEdgeAction(workflowId, edge.id);
        if (r?.error) toast.error(r.error);
        router.refresh();
      })();
    },
    [workflowId, router, setEdges],
  );

  // The blocked node ids (missing a sample output), for the amber edge treatment.
  const blockedNodes = useMemo(
    () =>
      new Set(propNodes.filter((n) => !outputsByNodeId[n.id]).map((n) => n.id)),
    [propNodes, outputsByNodeId],
  );

  // Display projection: give each edge an arrowhead coloured to match its line (amber when the
  // target step is blocked, accent otherwise). Derived from the store edges so onEdgesChange /
  // selection still operate on the base state.
  const styledEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        markerEnd: edgeMarker(blockedNodes.has(e.target)),
      })),
    [edges, blockedNodes],
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
      // Place the new node sensibly (the append RPC defaults pos to 0,0 → otherwise every new
      // step piles on the origin and its wires cross the other cards).
      const pos = placeNewNode(newNodeId, mode);
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
        // Re-number steps so the spliced node takes its place in the chain (not the last idx).
        if (!err) await reindexNodesByTopologyAction(workflowId);
      }
      if (pos)
        await updateNodePositionsAction(workflowId, [
          { id: newNodeId, pos_x: pos.x, pos_y: pos.y },
        ]);
      if (err) toast.error(`Step added, but linking it failed: ${err}`);
    }
    router.refresh();
  }

  // Where a freshly-created node should sit: a splice lands at the midpoint of the edge it splits
  // (nudged down so it's off the wire); a plain "new" step lands to the right of the chain tail.
  function placeNewNode(
    _newNodeId: string,
    mode: Editing,
  ): { x: number; y: number } | null {
    const byId = new Map(propNodes.map((n) => [n.id, n]));
    if (mode?.mode === "splice") {
      const s = byId.get(mode.edge.source);
      const t = byId.get(mode.edge.target);
      if (s && t)
        return { x: (s.pos_x + t.pos_x) / 2, y: (s.pos_y + t.pos_y) / 2 + 90 };
    }
    if (mode?.mode === "new" && tailNodeId) {
      const tail = byId.get(tailNodeId);
      if (tail) return { x: tail.pos_x + 320, y: tail.pos_y };
    }
    return null;
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
  const inspectorTitle =
    editing?.mode === "edit"
      ? editing.node.step_title
        ? `Edit · ${editing.node.step_title}`
        : "Edit step"
      : editing?.mode === "splice"
        ? "Insert a step"
        : "Add a step";

  return (
    <div className="relative flex h-[72vh] min-h-[480px] w-full overflow-hidden bg-[#f7f9fd] xl:h-full xl:min-h-0 dark:bg-transparent">
      {/* LEFT TOOL RAIL (mockup `.toolrail`, 64px glass column) */}
      <aside className="z-20 flex w-16 shrink-0 flex-col items-center gap-2.5 border-foreground/[0.06] border-r bg-background/45 py-4 backdrop-blur-xl">
        <RailButton
          accent
          label="Add step"
          icon={<Plus width={20} height={20} aria-hidden="true" />}
          onClick={() => setEditing({ mode: "new" })}
        />
        <div className="my-1 h-px w-7 bg-foreground/10" />
        <RailButton
          label="AI Skeleton"
          active={showSkeleton}
          icon={<Sparkles width={19} height={19} aria-hidden="true" />}
          onClick={() => setShowSkeleton((v) => !v)}
        />
        <RailButton
          disabled
          label="Templates · soon"
          icon={<LayoutGrid width={18} height={18} aria-hidden="true" />}
        />
        <RailButton
          disabled
          label="Comments · soon"
          icon={<MessageSquarePlus width={18} height={18} aria-hidden="true" />}
        />
        <div className="flex-1" />
        <RailButton
          accent
          label="Fit to view"
          icon={<Maximize2 width={18} height={18} aria-hidden="true" />}
          onClick={() => fitView({ padding: 0.2, duration: 300 })}
        />
      </aside>

      {/* CENTER — the React Flow canvas surface */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: double-click the empty canvas pane is a mouse-only add shortcut (AC1); the keyboard path is the rail "Add step" button */}
      <div
        className="relative min-w-0 flex-1"
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).classList.contains("react-flow__pane"))
            setEditing({ mode: "new" });
        }}
      >
        {/* Accent glow pooling in the canvas (mockup `.rfglow`). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(600px 360px at 30% 30%, rgba(109,94,240,0.08), transparent 70%)",
          }}
        />
        {/* Canvas bar (mockup `.canvas-bar`) — pointer-events-none so pan passes
            through; shows the live step count + the publish-blocked count. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between border-foreground/[0.05] border-b bg-background/65 px-[17px] py-[13px] backdrop-blur-xl">
          <div className="flex items-center gap-2.5 font-semibold text-[13px] text-foreground">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            Editing canvas
            <span className="rounded-full bg-accent px-2.5 py-1 font-semibold text-[11px] text-accent-foreground">
              {nodes.length} steps
            </span>
            {blockedNodes.size > 0 ? (
              <span className="rounded-full border border-warning/35 bg-warning/10 px-2.5 py-1 font-semibold text-[11px] text-warning">
                {blockedNodes.size} needs output
              </span>
            ) : null}
          </div>
          <div className="hidden items-center gap-2 text-[12px] text-muted-foreground lg:flex">
            Drag to connect · + to insert · × to disconnect · double-click to
            edit
          </div>
        </div>

        <SpliceContext.Provider
          value={(edge) => setEditing({ mode: "splice", edge })}
        >
          <RemoveEdgeContext.Provider value={removeEdge}>
            <BlockedNodesContext.Provider value={blockedNodes}>
              <OutputsProvider outputsByNodeId={outputsByNodeId}>
                <NodeActionsProvider actions={nodeActions}>
                  <ReactFlow
                    nodes={nodes}
                    edges={styledEdges}
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
          </RemoveEdgeContext.Provider>
        </SpliceContext.Provider>

        {/* AI Skeleton intake inset (mockup `.skeleton-intake`, bottom-left). */}
        {showSkeleton ? (
          <div className="absolute bottom-4 left-4 z-20 w-[300px] max-w-[calc(100%-2rem)]">
            <SkeletonIntake
              workflowId={workflowId}
              professionName={professionName}
              usedToday={skeletonUsedToday}
            />
          </div>
        ) : null}

        {/* INLINE INSPECTOR (mockup `.inspector`) — replaces the right drawer; the
            existing NodeForm renders inside a floating glass panel on the canvas. */}
        {editing ? (
          <div className="absolute inset-y-3 right-3 z-30 flex w-[372px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-[20px] border border-primary/40 bg-popover/95 shadow-[0_24px_70px_rgba(0,0,0,0.25)] ring-1 ring-primary/15 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-border/60 border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-primary shadow-[0_0_10px_rgba(109,94,240,0.6)]"
                />
                <span className="font-heading font-bold text-[14px] tracking-tight">
                  {inspectorTitle}
                </span>
                <span className="rounded-full bg-primary/12 px-2 py-0.5 font-bold text-[10px] text-primary uppercase tracking-[0.1em]">
                  Editing
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close inspector"
                className="flex size-7 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground"
              >
                <X width={15} height={15} aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-5">
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
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The React Flow authoring canvas (Story 2.3). Wrapped in ReactFlowProvider so
 * fitView + the instance store work. Reuses the shared RecipeCard as the node.
 * The mockup's editor surface is fused here: a left tool rail, the canvas, an
 * inline node inspector, and the AI Skeleton intake inset.
 */
export function WorkflowCanvas(props: {
  workflowId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  outputsByNodeId: Record<string, NodeOutputView>;
  professionName: string | null;
  skeletonUsedToday: number;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
