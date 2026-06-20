"use client";

import { Button } from "@/components/ui/button";

/**
 * Route-segment error boundary for the app shell — a render/data failure in any (app)
 * route lands here (inside the nav) with a retry, instead of crashing to the bare
 * full-page fallback. `reset()` re-renders the segment.
 */
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
        Something broke
      </p>
      <h1 className="font-heading font-bold text-2xl tracking-tight">
        We couldn't load this page
      </h1>
      <p className="text-muted-foreground">
        That's on us, not you. Give it another try — if it keeps happening, it
        should clear up shortly.
      </p>
      <Button onClick={reset} size="lg">
        Try again
      </Button>
    </div>
  );
}
