import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Placeholder for nav destinations whose real feature ships in a later epic, so
 * every nav link resolves instead of 404-ing.
 */
export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-6 py-24 text-center">
      <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent-foreground">
        Coming soon
      </span>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">
        {title}
      </h1>
      <p className="text-balance text-muted-foreground">{description}</p>
      <Link
        href="/"
        className={cn(buttonVariants({ variant: "outline" }), "mt-2")}
      >
        Back to home
      </Link>
    </main>
  );
}
