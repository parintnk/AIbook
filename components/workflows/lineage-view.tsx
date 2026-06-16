"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  buildLineageForest,
  DEFAULT_MAX_DEPTH,
  findLineageNode,
  type LayoutDirection,
  type LayoutSort,
  type LineageNode,
  lineagePath,
} from "@/lib/lineage";
import { cn } from "@/lib/utils";
import styles from "./lineage.module.css";
import { LineageDetailPanel } from "./lineage-detail-panel";
import { LineageTreeList } from "./lineage-tree-list";

// React Flow can't SSR — lazy + client-only, so the SSR/crawler/screen-reader primary is the
// indented list below (mirrors WorkflowViewerSurface / the Epic-3 list-first pattern).
const LineageGraph = dynamic(
  () => import("./lineage-graph").then((m) => m.LineageGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading lineage graph…
      </div>
    ),
  },
);

const SORTS: { key: LayoutSort; label: string }[] = [
  { key: "top", label: "Top forks" },
  { key: "worked", label: "By worked-rate" },
  { key: "author", label: "By author" },
];
const DEPTHS = [2, 3, 4, 99];

type View = "graph" | "list";

/**
 * The lineage tree surface (Story 5.3 / FR16 / UX-DR14) — the header strip (title · mono summary ·
 * direction/sort/depth/jump controls + a List/Graph toggle) over the two-pane body (the React Flow
 * graph + the selected-node detail panel). SSR renders the indented list (the a11y/crawler/mobile
 * primary); ≥md promotes to the spatial graph after mount. Read-only over the Story 5.1 closure
 * table — no writes.
 */
export function LineageView({
  nodes,
  rootId,
  currentId,
  ancestryIds,
  signedIn,
}: {
  nodes: LineageNode[];
  rootId: string;
  currentId: string;
  ancestryIds: string[];
  signedIn: boolean;
}) {
  const forest = useMemo(
    () => buildLineageForest(nodes, rootId),
    [nodes, rootId],
  );

  const [view, setView] = useState<View>("list");
  const [direction, setDirection] = useState<LayoutDirection>("LR");
  const [sort, setSort] = useState<LayoutSort>("top");
  const [maxDepth, setMaxDepth] = useState<number>(DEFAULT_MAX_DEPTH);
  const [selectedId, setSelectedId] = useState<string>(currentId);
  const [jumpSignal, setJumpSignal] = useState(0);
  // Parent ids whose collapsed "+N forks" siblings the user expanded (click on the badge).
  const [expanded, setExpanded] = useState<string[]>([]);

  // SSR-safe default = list; promote to the graph on desktop after mount.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setView("graph");
  }, []);

  if (!forest) {
    return (
      <div className="glass mt-6 rounded-card border border-border/60 p-10 text-center text-muted-foreground">
        This workflow has no readable lineage yet.
      </div>
    );
  }

  const depth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  const contributors = new Set(
    nodes.map((n) => n.author?.handle).filter(Boolean),
  ).size;
  const selectedNode = findLineageNode(forest, selectedId) ?? forest;
  const selectedPath = lineagePath(forest, selectedNode.id);
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "Top forks";

  return (
    <div
      className={cn(
        styles.root,
        "mt-6 overflow-hidden rounded-frame border border-border/60 shadow-sm",
      )}
    >
      <div className={styles.linHead}>
        <div className={styles.linTitle}>
          <h1 className={styles.titleRow}>
            <span className={styles.titleIcon}>
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="12" r="3" />
                <path d="M9 6h3a3 3 0 0 1 3 3M9 18h3a3 3 0 0 0 3-3" />
              </svg>
            </span>
            Lineage · {forest.title}
          </h1>
          <div className={cn(styles.summary, styles.mono)}>
            <span>
              <b>1</b> origin
            </span>
            <span className={styles.sep}>·</span>
            <span>
              <b>{forest.forkCount}</b> forks
            </span>
            <span className={styles.sep}>·</span>
            <span>
              depth <b>{depth}</b>
            </span>
            <span className={styles.sep}>·</span>
            <span>
              <b>{contributors}</b>{" "}
              {contributors === 1 ? "contributor" : "contributors"}
            </span>
          </div>
        </div>

        <div className={styles.linCtrls}>
          <div className={styles.seg}>
            <button
              type="button"
              className={cn(styles.segBtn, view === "list" && styles.segOn)}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              List
            </button>
            <button
              type="button"
              className={cn(styles.segBtn, view === "graph" && styles.segOn)}
              aria-pressed={view === "graph"}
              onClick={() => setView("graph")}
            >
              Graph
            </button>
          </div>

          {view === "graph" ? (
            <>
              <div className={styles.seg}>
                <button
                  type="button"
                  className={cn(
                    styles.segBtn,
                    direction === "TB" && styles.segOn,
                  )}
                  aria-pressed={direction === "TB"}
                  onClick={() => setDirection("TB")}
                >
                  Top-down
                </button>
                <button
                  type="button"
                  className={cn(
                    styles.segBtn,
                    direction === "LR" && styles.segOn,
                  )}
                  aria-pressed={direction === "LR"}
                  onClick={() => setDirection("LR")}
                >
                  Left-right
                </button>
              </div>
              <button
                type="button"
                className={styles.ctrlPill}
                onClick={() => {
                  const i = SORTS.findIndex((s) => s.key === sort);
                  setSort(SORTS[(i + 1) % SORTS.length].key);
                }}
              >
                <span className={styles.pillLab}>Sort:</span> {sortLabel}
                <span className={styles.chev}>
                  <Chevron />
                </span>
              </button>
              <button
                type="button"
                className={styles.ctrlPill}
                onClick={() => {
                  const i = DEPTHS.indexOf(maxDepth);
                  setMaxDepth(DEPTHS[(i + 1) % DEPTHS.length]);
                }}
              >
                <span className={styles.pillLab}>Show depth:</span>{" "}
                <span className={styles.mono}>
                  {maxDepth >= 99 ? "All" : maxDepth}
                </span>
                <span className={styles.chev}>
                  <Chevron />
                </span>
              </button>
              <button
                type="button"
                className={cn(styles.ctrlPill, styles.ctrlPillAccent)}
                onClick={() => setJumpSignal((s) => s + 1)}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 19V6M5 12l7-7 7 7" />
                </svg>
                Jump to root
              </button>
            </>
          ) : null}
        </div>
      </div>

      {view === "graph" ? (
        <div className={styles.linGrid}>
          <LineageGraph
            forest={forest}
            currentId={currentId}
            focusPath={ancestryIds}
            direction={direction}
            sort={sort}
            maxDepth={maxDepth}
            onSelect={setSelectedId}
            expanded={expanded}
            onExpand={(id) =>
              setExpanded((prev) => (prev.includes(id) ? prev : [...prev, id]))
            }
            jumpSignal={jumpSignal}
          />
          <LineageDetailPanel
            selected={selectedNode}
            path={selectedPath}
            isCurrent={selectedNode.id === currentId}
            signedIn={signedIn}
          />
        </div>
      ) : (
        <div className="max-h-[72vh] overflow-y-auto p-4">
          <LineageTreeList forest={forest} currentId={currentId} />
        </div>
      )}
    </div>
  );
}

function Chevron() {
  return (
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
