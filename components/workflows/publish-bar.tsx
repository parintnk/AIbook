"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { publishWorkflowAction } from "@/app/(app)/workflows/actions";
import { Button } from "@/components/ui/button";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";

/**
 * A server-action `redirect()` surfaces on the client as a thrown error carrying a
 * `digest` of `NEXT_REDIRECT;…`. We must distinguish it from a genuine failure so
 * the publish success path (which redirects) isn't mistaken for an error.
 */
function isRedirectError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/**
 * The publish gate UI (Story 2.5, FR9/FR10 MOAT). Lives in the edit-page header
 * so it's visible regardless of the List/Canvas toggle (and not lazy-loaded with
 * the canvas). It mirrors the server gate: a draft is publishable iff it has ≥1
 * step and every step has a sample output. The button is `aria-disabled` (not
 * native `disabled`) when blocked so screen-reader users can focus it and hear
 * why, via the live hint.
 */
export function PublishBar({
  workflowId,
  nodes,
  outputsByNodeId,
}: {
  workflowId: string;
  nodes: WorkflowNode[];
  outputsByNodeId: Record<string, NodeOutputView>;
}) {
  const router = useRouter();
  const hintId = useId();
  const [isPending, startTransition] = useTransition();
  // Server-confirmed missing ids after a stale-client rejection; re-paints the
  // hint to the truth even before router.refresh() re-derives the props.
  const [staleMissing, setStaleMissing] = useState<string[] | null>(null);

  const missingNodes = nodes.filter((n) => !outputsByNodeId[n.id]);
  const canPublish = nodes.length > 0 && missingNodes.length === 0;

  const hint =
    nodes.length === 0
      ? "Add a step to publish"
      : `${missingNodes.length} step${
          missingNodes.length === 1 ? "" : "s"
        } still need${missingNodes.length === 1 ? "s" : ""} a sample output`;

  function stepLabel(node: WorkflowNode): string {
    return `step ${node.idx + 1}${node.step_title ? ` · ${node.step_title}` : ""}`;
  }

  function onPublish() {
    if (!canPublish || isPending) return;
    setStaleMissing(null);
    startTransition(async () => {
      // Set a flash BEFORE the call: on success the action redirects to
      // /workflows (this component unmounts), so the toast is shown there.
      sessionStorage.setItem("workflow-flash", "Published.");
      let result: Awaited<ReturnType<typeof publishWorkflowAction>>;
      try {
        result = await publishWorkflowAction(workflowId);
      } catch (e) {
        // A successful action `redirect()`s — that surfaces here as a NEXT_REDIRECT
        // throw which MUST pass through untouched so navigation proceeds and the
        // flash survives to /workflows. Only a real error clears the flash (else a
        // stale "workflow-flash" fires a false "Published." toast on a later visit).
        if (!isRedirectError(e)) {
          sessionStorage.removeItem("workflow-flash");
          toast.error("Couldn't publish. Please try again.");
        }
        throw e;
      }
      // Only reached on rejection — success redirected away.
      sessionStorage.removeItem("workflow-flash");
      if (result?.missingNodeIds?.length) {
        setStaleMissing(result.missingNodeIds);
        const names = result.missingNodeIds
          .map((id) => nodes.find((n) => n.id === id))
          .filter((n): n is WorkflowNode => Boolean(n))
          .map(stepLabel);
        toast.error(
          names.length
            ? `Add a sample output to ${names.join(", ")} before publishing.`
            : result.error,
        );
        router.refresh();
      } else if (result?.error) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  // After a stale rejection, the hint reflects the server's count until refresh.
  const effectiveHint = staleMissing?.length
    ? `${staleMissing.length} step${
        staleMissing.length === 1 ? "" : "s"
      } still need${staleMissing.length === 1 ? "s" : ""} a sample output`
    : hint;

  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
        Draft
      </span>
      <div className="relative">
        <Button
          type="button"
          onClick={onPublish}
          aria-disabled={!canPublish || isPending}
          aria-describedby={canPublish ? undefined : hintId}
          className={!canPublish ? "opacity-60" : undefined}
        >
          {isPending ? "Publishing…" : "Publish"}
        </Button>
        {!canPublish ? (
          // <output> carries an implicit role=status; aria-live announces hint
          // changes (e.g. after a stale rejection re-paints the count).
          <output
            id={hintId}
            aria-live="polite"
            className="absolute top-full right-0 mt-2 w-max max-w-[16rem] rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-warning shadow-sm"
          >
            {effectiveHint}
          </output>
        ) : null}
      </div>
    </div>
  );
}
