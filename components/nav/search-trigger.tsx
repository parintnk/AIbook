"use client";

import { Search, Sparkles } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** Example goals that preview the Epic 10 semantic-search experience. */
const SUGGESTED_GOALS = [
  "logo + brand kit for a coffee shop",
  "SaaS landing page from a one-line brief",
  "weekly content calendar",
  "product photos that actually convert",
] as const;

/**
 * Opens a full-screen search surface (placeholder — real search is Epic 10).
 * Reused as a desktop pill and a mobile icon/tab; the trigger UI is passed in,
 * the surface (a top Sheet) is shared. base-ui's Dialog handles Esc + focus.
 */
export function SearchTrigger({
  children,
  className,
  ariaLabel = "Search",
}: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="top" className="h-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>Search</SheetTitle>
            <SheetDescription>
              Find workflows, professions, and creators by goal.
            </SheetDescription>
          </SheetHeader>
          <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-14">
            {/* search field + AI-goal mode pill [Source: search-light.html] */}
            <div className="flex items-center gap-3 rounded-full border border-input bg-card px-5 py-3 shadow-sm">
              <Search className="size-5 text-muted-foreground" aria-hidden />
              <input
                type="search"
                placeholder="Search workflows, tools, people…"
                className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-accent px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-accent-foreground sm:inline-flex">
                <Sparkles className="size-3" aria-hidden />
                AI goal
              </span>
            </div>

            {/* suggested goals — a designed preview, not a dead end */}
            <p className="mb-2 mt-5 px-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Try a goal
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_GOALS.map((goal) => (
                <span
                  key={goal}
                  className="inline-flex items-center rounded-full border border-border bg-secondary px-3.5 py-2 text-sm font-medium text-foreground/80"
                >
                  {goal}
                </span>
              ))}
            </div>

            <p className="mt-5 px-1 text-xs text-muted-foreground">
              Semantic search — matched by goal, ranked by what actually worked
              — arrives in a later release.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
