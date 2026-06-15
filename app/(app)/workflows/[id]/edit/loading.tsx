import {
  ViewerSurfaceSkeleton,
  WorkflowHeaderSkeleton,
} from "@/components/workflows/viewer-skeleton";

/**
 * Editor cold-load shield (Story 3.4). The sibling `[id]/loading.tsx` (the viewer
 * skeleton) would otherwise cascade onto this nested `[id]/edit` segment and flash the
 * viewer's trust-row skeleton on the editor — a wrong-surface placeholder. This gives
 * the edit segment its own Suspense boundary: a header + the surface (toggle + list)
 * skeleton with NO trust row (the editor has none). Minimal by design — it blocks the
 * wrong-surface flash, not a pixel match for the editor form.
 */
export default function Loading() {
  return (
    <div>
      <span className="sr-only">Loading editor…</span>
      <WorkflowHeaderSkeleton />
      <ViewerSurfaceSkeleton />
    </div>
  );
}
