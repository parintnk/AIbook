"use client";

import { Globe, Lock } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { setBoardVisibilityAction } from "@/app/(app)/boards/actions";
import { cn } from "@/lib/utils";
import styles from "./boards.module.css";

/**
 * Story 8.2 — the board's Public/Private segmented toggle (owner-only, on the management header).
 * Optimistic flip + revert-on-failure + toast + `isPending` guard + `useEffect` resync to the
 * revalidated server value (the JoinButton / sortable-canon pattern).
 */
export function VisibilityToggle({
  boardId,
  isPublic: initial,
}: {
  boardId: string;
  isPublic: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initial);
  const [isPending, startTransition] = useTransition();
  useEffect(() => setIsPublic(initial), [initial]);

  function set(next: boolean) {
    if (isPending || next === isPublic) return;
    setIsPublic(next); // optimistic
    startTransition(async () => {
      const res = await setBoardVisibilityAction(boardId, next);
      if (!res.ok) {
        setIsPublic(!next); // revert
        toast.error(res.error);
      }
    });
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled toggle-button group (role=group) — not a form fieldset; matches the mockup.
    <span
      className={styles.privtoggle}
      role="group"
      aria-label="Board visibility"
    >
      <button
        type="button"
        className={cn(isPublic && styles.on)}
        aria-pressed={isPublic}
        onClick={() => set(true)}
      >
        <Globe width={13} height={13} aria-hidden="true" />
        Public
      </button>
      <button
        type="button"
        className={cn(!isPublic && styles.on)}
        aria-pressed={!isPublic}
        onClick={() => set(false)}
      >
        <Lock width={13} height={13} aria-hidden="true" />
        Private
      </button>
    </span>
  );
}
