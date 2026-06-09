"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const ORDER = ["system", "light", "dark"] as const;
type ThemeChoice = (typeof ORDER)[number];

const ICONS: Record<ThemeChoice, typeof Monitor> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

/**
 * Accessible theme toggle cycling system → light → dark. Persists via
 * next-themes (localStorage). Temporary placement until the nav shell (Story 1.6).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: the resolved theme is only known on the client.
  useEffect(() => setMounted(true), []);

  const current: ThemeChoice =
    theme === "light" || theme === "dark" ? theme : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = ICONS[current];
  // Until mounted, the resolved theme is unknown — render a stable, theme-agnostic
  // label so SSR and the first client render match (no hydration mismatch).
  const label = mounted
    ? `Theme: ${current}. Switch to ${next}.`
    : "Toggle theme";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 glass rounded-full"
      aria-label={label}
      title={label}
      suppressHydrationWarning
      onClick={() => setTheme(next)}
    >
      {mounted ? (
        <Icon className="size-5" aria-hidden="true" />
      ) : (
        <Monitor className="size-5" aria-hidden="true" />
      )}
    </Button>
  );
}
