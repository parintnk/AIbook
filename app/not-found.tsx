import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/**
 * Root catch-all 404 for URLs that match no route at all (rendered in the root layout,
 * without the app nav). Most 404s are bad ids inside (app) and hit `app/(app)/not-found.tsx`;
 * this covers the rare truly-unmatched URL so it's still branded, not the framework default.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
        404
      </p>
      <h1 className="font-heading font-bold text-2xl tracking-tight">
        Page not found
      </h1>
      <p className="text-muted-foreground">
        That page doesn't exist or has moved.
      </p>
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        Go home
      </Link>
    </main>
  );
}
