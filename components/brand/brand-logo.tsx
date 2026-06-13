import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The "idea" brand glyph — a workflow-graph (fork/share) mark on the violet
 * gradient. Single source of truth for the logo so the nav, auth lockup, and
 * anywhere else stay in sync. Size it via `className` (defaults to 32px); the
 * icon scales with the box. [Source: DESIGN.md brand `.mark`]
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#7c6bff] to-primary shadow-md shadow-primary/30 ring-1 ring-inset ring-white/25",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[55%] text-white"
        aria-hidden="true"
      >
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="12" r="3" />
        <path d="M9 6h3a3 3 0 0 1 3 3M9 18h3a3 3 0 0 0 3-3" />
      </svg>
    </span>
  );
}

/**
 * Brand lockup: the mark + "idea" wordmark, linking home by default. Used in the
 * top nav and on pre-auth pages. Override `href` to point elsewhere; size the
 * glyph via `markClassName`.
 */
export function BrandLogo({
  href = "/",
  className,
  markClassName,
}: {
  href?: string;
  className?: string;
  markClassName?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="idea — home"
      className={cn("flex shrink-0 items-center gap-[11px]", className)}
    >
      <BrandMark className={markClassName} />
      <span className="font-heading text-[17px] font-extrabold leading-none tracking-[-0.02em] text-foreground">
        idea
      </span>
    </Link>
  );
}
