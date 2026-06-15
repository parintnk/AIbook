import { Skeleton } from "@/components/ui/skeleton";

/**
 * Cold-load skeleton pieces for the workflow detail surface (Story 3.4 / UX-DR21 /
 * NFR1). Static, server-renderable placeholders whose dimensions mirror the real
 * elements (`page.tsx` header, `trust-row.tsx`, the `workflow-canvas-viewer` frame)
 * so the swap to real content causes NO layout shift. Reused by the route
 * `loading.tsx` and the canvas dynamic-import fallback.
 */

/**
 * Matches `page.tsx`'s `<header className="flex flex-col gap-4">` (pill, title,
 * summary, author byline). `children` slot into the same flex-col so the trust-row
 * skeleton (which carries its own `mt-5`, like the real `<TrustRow>`) lands inside the
 * `gap-4` exactly as page.tsx renders it — zero layout shift. The editor shield omits
 * the child (no trust row there).
 */
export function WorkflowHeaderSkeleton({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-28 rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-2/5 max-w-2xl" />
      </div>
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      {children}
    </div>
  );
}

/** Matches `trust-row.tsx`'s `mt-5 flex flex-wrap gap-2.5` pill row (outcome / fork / lineage / last-verified). */
export function TrustRowSkeleton() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2.5">
      <Skeleton className="h-9 w-44 rounded-full" />
      <Skeleton className="h-9 w-28 rounded-full" />
      <Skeleton className="h-9 w-36 rounded-full" />
    </div>
  );
}

/**
 * Matches the `WorkflowViewerSurface` first paint — the toggle row + the linear step
 * LIST (not the canvas). The surface SSRs `view="list"` on every breakpoint (desktop
 * only promotes to canvas post-hydration), so the route `loading.tsx` resolves into a
 * variable-height list, NOT the 70vh canvas — a list-shaped skeleton (toggle +
 * card blocks at the same `mt-8`/`mt-6`/`gap-3` offsets) keeps that swap shift-stable.
 */
export function ViewerSurfaceSkeleton() {
  return (
    <section className="mt-8">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1 rounded-full bg-secondary p-0.5">
          <Skeleton className="h-7 w-14 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <Skeleton className="h-32 w-full rounded-node" />
        <Skeleton className="h-32 w-full rounded-node" />
        <Skeleton className="h-32 w-full rounded-node" />
      </div>
    </section>
  );
}

/**
 * Matches the `workflow-canvas-viewer` frame (`h-[70vh] rounded-card ring-1
 * ring-foreground/10`), with a few node-shaped hints. Used for the canvas
 * dynamic-import fallback (where the 70vh canvas genuinely loads) — NOT the route
 * loading shell (that's the list-shaped `ViewerSurfaceSkeleton`).
 */
export function CanvasFrameSkeleton() {
  return (
    <div className="h-[70vh] w-full overflow-hidden rounded-card p-6 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-28 w-72 rounded-node" />
        <Skeleton className="h-28 w-72 rounded-node" />
        <Skeleton className="h-28 w-72 rounded-node" />
      </div>
    </div>
  );
}
