import { BadgeCheck, Bookmark, GitFork } from "lucide-react";
import { cn } from "@/lib/utils";

const POINTS = [
  {
    icon: GitFork,
    title: "Fork any recipe",
    body: "Start from a proven workflow, not a blank page.",
  },
  {
    icon: BadgeCheck,
    title: 'Vote "Tried & Worked"',
    body: "Honest signal from people who actually ran it.",
  },
  {
    icon: Bookmark,
    title: "Keep your boards",
    body: "Your saved recipes carry across every device.",
  },
] as const;

/**
 * Pre-auth value proposition ("why an account"), shown beside the sign-in /
 * sign-up card on wider screens. [Source: ux mockup auth-light.html .valuepanel]
 */
export function AuthValuePanel({ className }: { className?: string }) {
  return (
    <aside className={cn("flex flex-col", className)}>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
        Why an account
      </p>
      <h2 className="mt-2 text-balance font-heading text-2xl font-extrabold leading-tight tracking-tight">
        Cook with the recipes that already worked.
      </h2>
      <p className="mt-3 text-muted-foreground">
        Save, fork, and remix real AI workflows from people doing your kind of
        work — and keep what you build in one place.
      </p>
      <ul className="mt-6 flex flex-col gap-4">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="font-medium text-foreground">{title}</span>
              <span className="text-sm text-muted-foreground">{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
