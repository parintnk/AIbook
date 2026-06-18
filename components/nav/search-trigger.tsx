"use client";

import { Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { buildSearchHref } from "@/lib/search";

/** Example goals that preview the semantic-search experience (Story 10.2). */
const SUGGESTED_GOALS = [
  "logo + brand kit for a coffee shop",
  "SaaS landing page from a one-line brief",
  "weekly content calendar",
  "product photos that actually convert",
] as const;

/**
 * Opens a full-screen search launcher (a top Sheet) that routes to the `/search` results page
 * (Story 10.2). Reused as a desktop pill and a mobile icon/tab; the trigger UI is passed in, the
 * launcher is shared. Submitting the field (Enter) or picking a suggested goal navigates to
 * `/search?q=…` and closes the sheet. base-ui's Dialog handles Esc + focus.
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  function go(goal: string) {
    const q = goal.trim();
    if (!q) return;
    setOpen(false);
    setValue("");
    router.push(buildSearchHref({ q }));
  }
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    go(value);
  }

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
              Find workflows by goal — described in plain language, not a tool
              name.
            </SheetDescription>
          </SheetHeader>
          <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-14">
            {/* search field + AI-goal mode pill [Source: search-light.html] */}
            <search>
              <form
                onSubmit={onSubmit}
                className="flex items-center gap-3 rounded-full border border-input bg-card px-5 py-3 shadow-sm"
              >
                <Search
                  className="size-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  enterKeyHint="search"
                  placeholder="Search workflows, tools, people…"
                  aria-label="Search workflows by goal"
                  className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />
                <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-accent px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-accent-foreground sm:inline-flex">
                  <Sparkles className="size-3" aria-hidden="true" />
                  AI goal
                </span>
              </form>
            </search>

            {/* suggested goals — a designed preview, not a dead end */}
            <p className="mb-2 mt-5 px-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Try a goal
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_GOALS.map((goal) => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => go(goal)}
                  className="inline-flex items-center rounded-full border border-border bg-secondary px-3.5 py-2 text-sm font-medium text-foreground/80 hover:bg-card hover:text-foreground"
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
