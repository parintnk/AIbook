import { Skeleton } from "@/components/ui/skeleton";

/**
 * Cold-load skeleton for /workflows/[id]/lineage (Story 5.3) — resolves the ancestry chain +
 * reads the lineage tree from the origin (medium weight). Mirrors page.tsx's back link + the
 * framed lineage panel (header bar + the indented tree LIST, which is the SSR-default view) so
 * the swap is shift-stable. `sr-only` owns the a11y cue; the blocks are decorative.
 */

// Indents evoke the tree's depth nesting (root → child → grandchild → child).
const ROWS = [
  { key: "a", indent: "" },
  { key: "b", indent: "ml-6" },
  { key: "c", indent: "ml-12" },
  { key: "d", indent: "ml-6" },
];

export default function Loading() {
  return (
    <div>
      <span className="sr-only">Loading lineage…</span>
      <Skeleton className="h-5 w-36" />
      <div className="mt-6 overflow-hidden rounded-frame border border-border/60 shadow-sm">
        {/* Header bar (title + summary + view/sort controls). */}
        <div className="flex items-center justify-between gap-4 border-border/60 border-b p-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
        {/* Indented lineage tree list (the SSR-default view). */}
        <div className="flex flex-col gap-3 p-4">
          {ROWS.map((r) => (
            <Skeleton key={r.key} className={`${r.indent} h-16 rounded-node`} />
          ))}
        </div>
      </div>
    </div>
  );
}
