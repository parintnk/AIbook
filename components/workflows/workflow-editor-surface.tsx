"use client";

import dynamic from "next/dynamic";
import { DoctorPanel } from "@/components/ai/doctor-panel";
import { AI_FEATURE_CAPS } from "@/lib/ai";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowEdge } from "@/lib/services/workflow-edges";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { WorkflowEditbar } from "./workflow-editbar";

// The React Flow canvas is client-only + heavy → lazy-load with ssr:false. This
// is legal ONLY inside a Client Component (Next 16 forbids ssr:false in an RSC),
// which is exactly why this surface wrapper exists. It also keeps React Flow out
// of the initial route bundle until the editor mounts.
const WorkflowCanvas = dynamic(
  () => import("./workflow-canvas").then((m) => m.WorkflowCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[72vh] min-h-[560px] items-center justify-center text-muted-foreground text-sm">
        Loading canvas…
      </div>
    ),
  },
);

/**
 * Story 2.3 — the draft editor surface, fused into ONE bordered container to match
 * `workflow-editor-{light,dark}.html`: the editbar sits on top (border-b); the body
 * is the `1fr · doctor` grid (the tool rail lives INSIDE the canvas). Canvas-only —
 * the linear list view was removed; metadata tucks into a disclosure below.
 */
export function WorkflowEditorSurface({
  workflowId,
  title,
  nodes,
  edges,
  outputsByNodeId,
  professionName,
  skeletonUsedToday,
  doctorUsedToday,
}: {
  workflowId: string;
  title: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  outputsByNodeId: Record<string, NodeOutputView>;
  professionName: string | null;
  skeletonUsedToday: number;
  doctorUsedToday: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_30px_color-mix(in_srgb,var(--foreground)_8%,transparent)]">
      <WorkflowEditbar
        workflowId={workflowId}
        initialTitle={title}
        professionName={professionName}
        nodes={nodes}
        outputsByNodeId={outputsByNodeId}
      />

      <div className="grid xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <WorkflowCanvas
            workflowId={workflowId}
            nodes={nodes}
            edges={edges}
            outputsByNodeId={outputsByNodeId}
            professionName={professionName}
            skeletonUsedToday={skeletonUsedToday}
          />
        </div>
        {/* Workflow Doctor (Story 11.3) — the fused right column (mockup `.doctor`,
            border-left). `id="doctor"` is the editbar "Review with Doctor" scroll
            target; scroll-mt clears the sticky app nav. Scrolls internally on xl. */}
        <aside
          id="doctor"
          className="scroll-mt-24 border-border max-xl:border-t xl:h-[72vh] xl:overflow-y-auto xl:border-l"
        >
          <DoctorPanel
            workflowId={workflowId}
            usedToday={doctorUsedToday}
            limit={AI_FEATURE_CAPS.doctor}
          />
        </aside>
      </div>
    </div>
  );
}
