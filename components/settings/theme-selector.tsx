"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

/**
 * 3-up theme selector (System · Light · Dark), persisted via next-themes. Native
 * radio inputs (shared name) give the group + keyboard semantics for free; the
 * cards are styled labels.
 */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Until mounted, the resolved theme is unknown — render a stable default.
  const current = mounted ? (theme ?? "system") : "system";

  return (
    <fieldset className="m-0 grid grid-cols-3 gap-3 border-0 p-0">
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map((o) => {
        const active = current === o.value;
        return (
          <label
            key={o.value}
            className={cn(
              "glass flex h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-card text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              active
                ? "ring-2 ring-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={o.value}
              checked={active}
              onChange={() => setTheme(o.value)}
              className="sr-only"
            />
            <o.icon className="size-5" aria-hidden />
            {o.label}
          </label>
        );
      })}
    </fieldset>
  );
}
