"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { WorkflowEdge } from "@/lib/services/workflow-edges";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { cn } from "@/lib/utils";
import { WorkflowSteps } from "./workflow-steps";

// The React Flow canvas is client-only + heavy → lazy-load with ssr:false. This
// is legal ONLY inside a Client Component (Next 16 forbids ssr:false in an RSC),
// which is exactly why this surface wrapper exists. It also keeps React Flow out
// of the initial route bundle until the user opens the canvas.
const WorkflowCanvas = dynamic(
  () => import("./workflow-canvas").then((m) => m.WorkflowCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="mt-6 flex h-[70vh] items-center justify-center rounded-card ring-1 ring-foreground/10 text-sm text-muted-foreground">
        Loading canvas…
      </div>
    ),
  },
);

type View = "list" | "canvas";

/**
 * Story 2.3 — the draft editor surface. Toggles between the linear step-list
 * (UX-DR22 — the a11y/mobile primary) and the React Flow canvas (the `≥md`
 * desktop augmentation). Desktop-first: canvas becomes the default on `≥md` after
 * mount; on `<md` the canvas is never offered (list only + a "best on desktop" hint).
 */
export function WorkflowEditorSurface({
  workflowId,
  nodes,
  edges,
}: {
  workflowId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}) {
  const [view, setView] = useState<View>("list");

  // SSR-safe default = list; promote to canvas on desktop after mount.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setView("canvas");
  }, []);

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold tracking-tight">
            Steps
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The recipe — connect tools into a flow.
          </p>
        </div>
        {/* Canvas is a desktop affordance (UX-DR25) — toggle hidden on phones. */}
        <div className="hidden items-center gap-1 rounded-full bg-secondary p-0.5 md:flex">
          <ToggleButton
            active={view === "list"}
            onClick={() => setView("list")}
          >
            List
          </ToggleButton>
          <ToggleButton
            active={view === "canvas"}
            onClick={() => setView("canvas")}
          >
            Canvas
          </ToggleButton>
        </div>
      </div>

      {view === "canvas" ? (
        <div className="mt-6">
          <WorkflowCanvas workflowId={workflowId} nodes={nodes} edges={edges} />
        </div>
      ) : (
        <>
          <WorkflowSteps workflowId={workflowId} nodes={nodes} hideHeader />
          <p className="mt-3 text-xs text-muted-foreground md:hidden">
            Tip: the visual canvas editor is best on a larger screen.
          </p>
        </>
      )}
    </section>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3 py-1 text-sm font-medium transition",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
