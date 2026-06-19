"use client";

import dynamic from "next/dynamic";
import { DoctorPanel } from "@/components/ai/doctor-panel";
import { SkeletonIntake } from "@/components/ai/skeleton-intake";
import { AI_FEATURE_CAPS } from "@/lib/ai";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowEdge } from "@/lib/services/workflow-edges";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";

// The React Flow canvas is client-only + heavy → lazy-load with ssr:false. This
// is legal ONLY inside a Client Component (Next 16 forbids ssr:false in an RSC),
// which is exactly why this surface wrapper exists. It also keeps React Flow out
// of the initial route bundle until the editor mounts.
const WorkflowCanvas = dynamic(
  () => import("./workflow-canvas").then((m) => m.WorkflowCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="mt-6 flex h-[72vh] min-h-[560px] items-center justify-center rounded-card text-muted-foreground text-sm ring-1 ring-foreground/10">
        Loading canvas…
      </div>
    ),
  },
);

/**
 * Story 2.3 — the draft editor surface. Canvas-only: the linear list view was
 * removed (matching workflow-editor-light.html), so the React Flow canvas is the
 * single editing surface — best on desktop. The editor is auth-gated (no crawler /
 * SEO need for an SSR list, unlike the public viewer).
 */
export function WorkflowEditorSurface({
  workflowId,
  nodes,
  edges,
  outputsByNodeId,
  professionName,
  skeletonUsedToday,
  doctorUsedToday,
}: {
  workflowId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  outputsByNodeId: Record<string, NodeOutputView>;
  professionName: string | null;
  skeletonUsedToday: number;
  doctorUsedToday: number;
}) {
  return (
    <section className="mt-10">
      <div>
        <h2 className="font-heading font-bold text-lg tracking-tight">Steps</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          The recipe — connect tools into a flow.
        </p>
      </div>

      <div className="mt-5">
        <SkeletonIntake
          workflowId={workflowId}
          professionName={professionName}
          usedToday={skeletonUsedToday}
        />
      </div>

      <div className="mt-6">
        <WorkflowCanvas
          workflowId={workflowId}
          nodes={nodes}
          edges={edges}
          outputsByNodeId={outputsByNodeId}
        />
      </div>
      <p className="mt-3 text-muted-foreground text-xs md:hidden">
        Tip: the visual canvas editor is best on a larger screen.
      </p>

      {/* Workflow Doctor (Story 11.3) — advisory pre-publish review. */}
      <div className="mt-6 flex justify-end">
        <DoctorPanel
          workflowId={workflowId}
          usedToday={doctorUsedToday}
          limit={AI_FEATURE_CAPS.doctor}
        />
      </div>
    </section>
  );
}
