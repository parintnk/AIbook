"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAME } from "@/lib/site";

// Hidden on the full-screen editor / lineage surfaces (they own the viewport, no page scroll) —
// same rule as the workflows full-bleed layout.
const FULL_BLEED = /\/workflows\/[^/]+\/(edit|lineage)$/;

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/communities", label: "Communities" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function SiteFooter() {
  const pathname = usePathname();
  if (FULL_BLEED.test(pathname)) return null;

  return (
    <footer className="mt-auto border-border/60 border-t px-6 pt-8 pb-[calc(2rem+4rem+env(safe-area-inset-bottom))] lg:pb-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <span className="text-muted-foreground text-sm">
          {SITE_NAME} — a cookbook for AI workflows
        </span>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-foreground text-sm transition hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
