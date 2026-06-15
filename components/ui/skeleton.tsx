import { cn } from "@/lib/utils";

/**
 * Cold-load placeholder (Story 3.4). The shadcn `Skeleton` primitive — a pulsing
 * block the loading skeletons compose. `motion-reduce:animate-none` honors
 * `prefers-reduced-motion` (the shimmer is never load-bearing; reduced-motion users
 * get a static placeholder).
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      // Decorative placeholder — kept out of the a11y tree; the loading container
      // owns the `role="status"` + visually-hidden "Loading…" announcement.
      aria-hidden="true"
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-md bg-foreground/[0.06] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
