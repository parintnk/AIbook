import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Graceful not-found for a workflow id (Story 3.1 / AC3). Covers a draft, a removed
 * workflow, or one the visitor can't access — RLS returns null and the viewer (and
 * the editor's notFound()) render this instead of a raw 404.
 */
export default function WorkflowNotFound() {
  return (
    <div className="glass mx-auto mt-16 flex max-w-md flex-col items-center gap-4 rounded-card px-6 py-12 text-center">
      <h1 className="font-bold font-heading text-xl tracking-tight">
        This workflow isn’t available
      </h1>
      <p className="text-muted-foreground text-sm">
        It may be a private draft, or it was removed. Try exploring published
        workflows instead.
      </p>
      <Link href="/explore" className={cn(buttonVariants(), "mt-2")}>
        Explore workflows
      </Link>
    </div>
  );
}
