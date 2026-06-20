"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteAccountAction } from "@/app/(app)/settings/danger/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/**
 * Type-to-confirm account deletion. The Delete button stays disabled until the user types their
 * own @handle — irreversible + destructive, so the confirm is deliberate (no one-click). On success
 * we sign the now-orphaned session out client-side and send them home.
 */
export function DeleteAccountButton({ handle }: { handle: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [isPending, startTransition] = useTransition();
  const armed = confirm.trim().toLowerCase() === handle.toLowerCase();

  function onDelete() {
    if (!armed) return;
    startTransition(async () => {
      const res = await deleteAccountAction();
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't delete your account.");
        return;
      }
      await createClient().auth.signOut();
      toast.success("Your account has been deleted.");
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 max-w-md rounded-xl border border-destructive/40 bg-destructive/5 p-5">
      <p className="font-medium text-foreground text-sm">
        Permanently delete your account
      </p>
      <p className="mt-1 text-muted-foreground text-sm">
        This erases your profile, workflows, comments and follows for good.
        Forks other people already made will stay, detached. This can’t be
        undone.
      </p>
      <label
        htmlFor="confirm-handle"
        className="mt-4 block text-muted-foreground text-xs"
      >
        Type{" "}
        <span className="font-mono font-semibold text-foreground">
          {handle}
        </span>{" "}
        to confirm
      </label>
      <Input
        id="confirm-handle"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder={handle}
        autoComplete="off"
        className="mt-1.5"
      />
      <Button
        type="button"
        variant="destructive"
        disabled={!armed || isPending}
        onClick={onDelete}
        className="mt-4"
      >
        {isPending ? "Deleting…" : "Delete my account"}
      </Button>
    </div>
  );
}
