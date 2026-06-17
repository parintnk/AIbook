"use client";

import { Check, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  joinProfessionAction,
  leaveProfessionAction,
} from "@/app/(app)/communities/[slug]/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Join / Joined control for a profession (Story 6.2 / FR18 / DR-5 optimistic). The toggle
 * flips Joined instantly and reverts with a toast on error; the membership row + the
 * trigger-maintained member_count are the truth (revalidatePath re-renders the hero count).
 * Signed-out → a "Join" link to sign-in (the insert is auth-gated). A moderator / verified_pro
 * is `joined` but `!canLeave` (RLS blocks their self-leave) → the button shows "Joined" disabled.
 * The `isPending` guard blocks a double-click double-insert.
 */
export function JoinButton({
  professionId,
  professionSlug,
  initialJoined,
  isAuthed,
  canLeave,
}: {
  professionId: string;
  professionSlug: string;
  initialJoined: boolean;
  isAuthed: boolean;
  canLeave: boolean;
}) {
  const [joined, setJoined] = useState(initialJoined);
  const [isPending, startTransition] = useTransition();

  // Reconcile to server truth after a revalidatePath re-render (the RSC parent passes a
  // fresh `initialJoined`); props only change on refresh/nav, never mid-flight.
  useEffect(() => setJoined(initialJoined), [initialJoined]);

  if (!isAuthed) {
    return (
      <Link
        href={`/sign-in?next=/communities/${professionSlug}`}
        className={cn(buttonVariants(), "shrink-0")}
      >
        <UserPlus className="size-4" aria-hidden />
        Join
      </Link>
    );
  }

  function toggle() {
    if (isPending || (joined && !canLeave)) return;
    const next = !joined;
    setJoined(next); // optimistic
    startTransition(async () => {
      const res = next
        ? await joinProfessionAction(professionId)
        : await leaveProfessionAction(professionId);
      if (!res.ok) {
        setJoined(!next); // revert
        toast.error(res.error);
      }
    });
  }

  return (
    <Button
      type="button"
      onClick={toggle}
      disabled={isPending || (joined && !canLeave)}
      variant={joined ? "secondary" : "default"}
      aria-pressed={joined}
      className="shrink-0"
    >
      {joined ? (
        <Check className="size-4" aria-hidden />
      ) : (
        <UserPlus className="size-4" aria-hidden />
      )}
      {joined ? "Joined" : "Join"}
    </Button>
  );
}
