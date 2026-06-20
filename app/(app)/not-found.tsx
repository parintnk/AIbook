import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/**
 * Branded 404 inside the app shell — every `notFound()` in an (app) route (a bad
 * workflow / profile / community / board id) lands here with the nav, not the bare
 * framework default.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
        404
      </p>
      <h1 className="font-heading font-bold text-2xl tracking-tight">
        Page not found
      </h1>
      <p className="text-muted-foreground">
        That page doesn't exist or has moved. Let's get you back to the recipes.
      </p>
      <Link href="/explore" className={buttonVariants({ size: "lg" })}>
        Browse workflows
      </Link>
    </div>
  );
}
