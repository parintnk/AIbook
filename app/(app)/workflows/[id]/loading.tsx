import {
  TrustRowSkeleton,
  ViewerSurfaceSkeleton,
  WorkflowHeaderSkeleton,
} from "@/components/workflows/viewer-skeleton";

/**
 * Cold-load skeleton for the public workflow detail route (Story 3.4 / NFR1). Next
 * streams this as the Suspense fallback while `page.tsx`'s RSC awaits
 * `getPublishedWorkflow` + the node/edge/output fetch. It mirrors `page.tsx`'s tree
 * (header → trust row inside the header's `gap-4` → the surface's `mt-8` toggle +
 * step LIST — the surface's SSR first paint on every breakpoint) so the swap to real
 * content is shift-stable, and the shell paints immediately (LCP < 2.5s).
 *
 * `role="status"` + the visually-hidden label give screen readers a loading cue; the
 * skeleton blocks themselves are `aria-hidden` (decorative). `[id]/edit` has its own
 * `loading.tsx` shield since this boundary cascades to nested segments.
 */
export default function Loading() {
  return (
    <div>
      <span className="sr-only">Loading workflow…</span>
      <WorkflowHeaderSkeleton>
        <TrustRowSkeleton />
      </WorkflowHeaderSkeleton>
      <ViewerSurfaceSkeleton />
    </div>
  );
}
