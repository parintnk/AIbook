"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowEdge } from "@/lib/services/workflow-edges";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { cn } from "@/lib/utils";
import { WorkflowStepList } from "./workflow-step-list";

// Canvas is client-only (React Flow can't SSR) — lazy so it stays out of the initial
// bundle and off the mobile-default path (the list is the SSR'd primary). dynamic(
// ssr:false) must live in a client component, not the RSC page (mirrors
// workflow-editor-surface.tsx).
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

type View = "list" | "canvas";

/**
 * The public viewer surface (Story 3.2 / UX-DR22 / UX-DR25). Toggles between the
 * linear step-list (the a11y + mobile primary) and the read-only React Flow canvas
 * (the spatial view). The initial/SSR state is ALWAYS `list` — so the ordered
 * step-list is the no-JS / crawler / screen-reader primary content on every
 * breakpoint — then `≥md` promotes to the canvas after mount (the desktop "home
 * surface", matching the mockup + Story 3.1). Mobile stays on the list (no `≥md`
 * match → no promote), with the toggle available to opt into the canvas. Unlike the
 * editor surface, the toggle is visible on ALL breakpoints (AC2: the mobile "View as
 * canvas" affordance).
 *
 * ⚠️ Keep the initial `useState` as `"list"` — setting it to `"canvas"` would drop
 * the list from the SSR HTML and break the a11y/crawler primary path (AC1) + the
 * mobile default (AC2). The brief desktop list→canvas flash is the accepted
 * trade-off (identical to the editor).
 */
export function WorkflowViewerSurface({
  nodes,
  edges,
  outputsByNodeId,
}: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  outputsByNodeId: Record<string, NodeOutputView>;
}) {
  const [view, setView] = useState<View>("list");

  // SSR-safe default = list; promote to canvas on desktop after mount.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setView("canvas");
  }, []);

  return (
    <section className="mt-8">
      <h2 className="sr-only">Workflow steps</h2>
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1 rounded-full bg-secondary p-0.5">
          <ToggleButton
            active={view === "list"}
            onClick={() => setView("list")}
            label="View as list"
          >
            List
          </ToggleButton>
          <ToggleButton
            active={view === "canvas"}
            onClick={() => setView("canvas")}
            label="View as canvas"
          >
            Canvas
          </ToggleButton>
        </div>
      </div>

      {view === "canvas" ? (
        <div className="mt-4">
          <WorkflowCanvasViewer
            nodes={nodes}
            edges={edges}
            outputsByNodeId={outputsByNodeId}
          />
        </div>
      ) : (
        <WorkflowStepList
          nodes={nodes}
          edges={edges}
          outputsByNodeId={outputsByNodeId}
        />
      )}
    </section>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "rounded-full px-3 py-1 text-sm font-medium outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
