"use client";

import { GitFork } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { forkWorkflowAction } from "@/app/(app)/workflows/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Fork action (Story 5.1 / FR15 / UX-DR7). A PRIMARY button, distinct from Save. NOT optimistic —
 * it waits for the server to copy the workflow into a new draft, then toasts "Forked. Editing your
 * copy." and navigates the user into their new draft's editor. Signed-out → a "Sign in to fork"
 * link (the action is auth-gated). The `isPending` guard blocks a double-fork.
 */
export function ForkButton({
  workflowId,
  signedIn,
}: {
  workflowId: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Link
        href={`/sign-in?next=/workflows/${workflowId}`}
        className={cn(buttonVariants(), "shrink-0")}
      >
        <GitFork className="size-4" aria-hidden />
        Sign in to fork
      </Link>
    );
  }

  function fork() {
    if (isPending) return;
    startTransition(async () => {
      const res = await forkWorkflowAction(workflowId);
      if (res.ok) {
        toast("Forked. Editing your copy.");
        router.push(`/workflows/${res.forkId}/edit`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button
      onClick={fork}
      disabled={isPending}
      className="shrink-0 bg-gradient-to-br from-[#7c6bff] to-[#6d5ef0] shadow-[0_8px_20px_rgba(109,94,240,0.28)] hover:brightness-[1.04]"
    >
      <GitFork className="size-4" aria-hidden />
      {isPending ? "Forking…" : "Fork"}
    </Button>
  );
}
