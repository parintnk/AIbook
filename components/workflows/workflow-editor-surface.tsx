"use client";

import dynamic from "next/dynamic";
import { DoctorPanel } from "@/components/ai/doctor-panel";
import { AI_FEATURE_CAPS } from "@/lib/ai";
import type { Tag } from "@/lib/explore";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowEdge } from "@/lib/services/workflow-edges";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import type { WorkflowDetailsValues } from "@/lib/validation/workflow";
import { WorkflowEditbar } from "./workflow-editbar";
import type { ProfessionOption } from "./workflow-form";

// The React Flow canvas is client-only + heavy → lazy-load with ssr:false. This
// is legal ONLY inside a Client Component (Next 16 forbids ssr:false in an RSC),
// which is exactly why this surface wrapper exists. It also keeps React Flow out
// of the initial route bundle until the editor mounts.
const WorkflowCanvas = dynamic(
  () => import("./workflow-canvas").then((m) => m.WorkflowCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[480px] items-center justify-center text-muted-foreground text-sm">
        Loading canvas…
      </div>
    ),
  },
);

/**
 * Story 2.3 — the draft editor surface, ONE bordered container matching
 * `workflow-editor-{light,dark}.html`: editbar (border-b) + a `1fr · doctor` body
 * (the tool rail lives INSIDE the canvas). On xl it fills the viewport below the nav
 * (full-bleed, no page scroll — the page wrapper sets the height); below xl it's a
 * rounded card. Metadata lives behind the editbar's "Details" dialog, not on the canvas.
 */
export function WorkflowEditorSurface({
  workflowId,
  title,
  nodes,
  edges,
  outputsByNodeId,
  professionName,
  professions,
  allTags,
  detailsDefaults,
  skeletonUsedToday,
  doctorUsedToday,
}: {
  workflowId: string;
  title: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  outputsByNodeId: Record<string, NodeOutputView>;
  professionName: string | null;
  professions: ProfessionOption[];
  allTags: Tag[];
  detailsDefaults: WorkflowDetailsValues;
  skeletonUsedToday: number;
  doctorUsedToday: number;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_30px_color-mix(in_srgb,var(--foreground)_8%,transparent)] xl:h-full xl:rounded-none xl:border-0 xl:shadow-none">
      <WorkflowEditbar
        workflowId={workflowId}
        initialTitle={title}
        professionName={professionName}
        nodes={nodes}
        outputsByNodeId={outputsByNodeId}
        professions={professions}
        allTags={allTags}
        detailsDefaults={detailsDefaults}
      />

      <div className="grid min-h-0 flex-1 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 xl:h-full">
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
          className="scroll-mt-24 border-border max-xl:border-t xl:h-full xl:overflow-y-auto xl:border-l"
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
