"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { useEffect, useMemo } from "react";
import {
  type LayoutDirection,
  type LayoutSort,
  type LineageTreeNode,
  layoutLineage,
} from "@/lib/lineage";
import styles from "./lineage.module.css";
import {
  type ForkBadgeFlowNode,
  ForkBadgeNode,
  type LeafClusterFlowNode,
  LeafClusterNode,
  type LineageFlowNode,
  LineageNodeCard,
} from "./lineage-node";

const nodeTypes = {
  lineage: LineageNodeCard,
  forkBadge: ForkBadgeNode,
  leafCluster: LeafClusterNode,
};

type Props = {
  forest: LineageTreeNode;
  currentId: string;
  focusPath: string[];
  direction: LayoutDirection;
  sort: LayoutSort;
  maxDepth: number;
  onSelect: (id: string) => void;
  expanded: string[];
  onExpand: (id: string) => void;
  jumpSignal: number;
};

function Flow({
  forest,
  currentId,
  focusPath,
  direction,
  sort,
  maxDepth,
  onSelect,
  expanded,
  onExpand,
  jumpSignal,
}: Props) {
  const rf = useReactFlow();

  const { rfNodes, rfEdges } = useMemo(() => {
    const { items, edges } = layoutLineage(forest, {
      direction,
      maxDepth,
      focusPath: new Set(focusPath),
      currentId,
      sort,
      expanded: new Set(expanded),
    });
    const rfNodes: Node[] = items.map((it) => {
      if (it.kind === "forkbadge") {
        return {
          id: it.id,
          type: "forkBadge",
          position: { x: it.x, y: it.y },
          data: {
            hiddenCount: it.hiddenCount,
            parentId: it.parentId,
            direction,
          },
          draggable: false,
        } satisfies ForkBadgeFlowNode;
      }
      if (it.kind === "leafcluster") {
        return {
          id: it.id,
          type: "leafCluster",
          position: { x: it.x, y: it.y },
          data: { count: it.count, avatars: it.avatars, direction },
          draggable: false,
          selectable: false,
        } satisfies LeafClusterFlowNode;
      }
      return {
        id: it.id,
        type: "lineage",
        position: { x: it.x, y: it.y },
        data: {
          node: it.node,
          isRoot: it.isRoot,
          isCurrent: it.isCurrent,
          dimmed: it.dimmed,
          direction,
        },
        draggable: false,
      } satisfies LineageFlowNode;
    });
    const rfEdges: Edge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      style: {
        opacity: e.dashed ? 0.55 : e.focus ? 1 : 0.42,
        strokeWidth: e.focus ? 3 : 2,
        strokeDasharray: e.dashed ? "2 6" : undefined,
      },
    }));
    return { rfNodes, rfEdges };
  }, [forest, currentId, focusPath, direction, sort, maxDepth, expanded]);

  // Controlled WITH onNodesChange (not bare `nodes`): without a change handler React Flow
  // can't write measured node dimensions back to the store, so the MiniMap draws zero-size
  // (invisible) rects. useNodesState wires it; re-seed the state when the layout recomputes.
  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-seed on layout recompute (rfNodes/rfEdges identity) only.
  useEffect(() => {
    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [rfNodes, rfEdges]);

  // Re-fit when the layout shape changes (direction / depth / sort / expand).
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-fit on layout-shape change only.
  useEffect(() => {
    const t = setTimeout(
      () => rf.fitView({ padding: 0.18, duration: 300 }),
      60,
    );
    return () => clearTimeout(t);
  }, [direction, maxDepth, sort, expanded, rf]);

  // "Jump to root" — centre on the origin root node (matched by id, not geometry — its x is 0 in
  // LR but not TB).
  useEffect(() => {
    if (jumpSignal === 0) return;
    const root = rfNodes.find((n) => n.id === forest.id);
    if (root)
      rf.setCenter(root.position.x + 97, root.position.y + 80, {
        zoom: 1,
        duration: 400,
      });
  }, [jumpSignal, rf, rfNodes, forest.id]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      edgesFocusable={false}
      deleteKeyCode={null}
      minZoom={0.3}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_, node) => {
        if (node.type === "lineage") onSelect(node.id);
        else if (node.type === "forkBadge") {
          const pid = (node.data as { parentId?: string }).parentId;
          if (pid) onExpand(pid);
        }
      }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1.1}
        color="rgba(128,128,150,0.2)"
      />
      <Controls showInteractive={false} position="bottom-right" />
      <MiniMap
        pannable
        zoomable
        bgColor="transparent"
        nodeStrokeWidth={0}
        nodeColor={(n) =>
          n.type === "forkBadge" ? "rgba(109,94,240,.4)" : "#6d5ef0"
        }
        maskColor="rgba(109,94,240,.1)"
        className="!rounded-[14px]"
      />
    </ReactFlow>
  );
}

/**
 * The lineage graph (Story 5.3 / FR16 / UX-DR14) — the focus+context React Flow canvas from the
 * locked `lineage-light.html` mockup. Reuses the Epic-3 read-only viewer shell (non-draggable /
 * non-connectable / fit-view / hidden attribution) with NEW lineage node + fork-badge node types
 * and a manual depth/sibling layout (no dagre dep). The root is crowned "Origin", the current
 * workflow glows "You are here", off-focus context nodes dim, and dense siblings collapse into
 * "+N forks" badges. Lazy-loaded `ssr:false` (React Flow can't SSR) — the indented list is the
 * SSR/a11y primary.
 */
export function LineageGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <div className={`relative h-full w-full ${styles.canvasShell}`}>
        <div className={styles.rfGlow} />
        <span className={styles.focuslabel}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
          Focused on your lineage path
        </span>
        <Flow {...props} />
        <span className={styles.lazycap}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4" />
          </svg>
          Showing <b>top forks</b> · expand any <b>+N</b> · deeper levels load
          on demand
        </span>
      </div>
    </ReactFlowProvider>
  );
}
