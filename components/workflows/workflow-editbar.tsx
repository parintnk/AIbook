"use client";

import { Check, Pencil, ShieldCheck, Workflow } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { renameDraftAction } from "@/app/(app)/workflows/actions";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { PublishBar } from "./publish-bar";

/**
 * The editor editbar (mockup `.editbar`) — the top bar of the fused editor surface:
 * brand mark + breadcrumb + an inline title field (autosaves on blur, no redirect) +
 * a Saved/Unsaved indicator + "Review with Doctor" (scrolls to the panel) + Publish.
 * The title autosaves through `renameDraftAction` so the editbar needs no <form>,
 * letting it fuse seamlessly above the canvas + Doctor columns.
 */
export function WorkflowEditbar({
  workflowId,
  initialTitle,
  professionName,
  nodes,
  outputsByNodeId,
}: {
  workflowId: string;
  initialTitle: string;
  professionName: string | null;
  nodes: WorkflowNode[];
  outputsByNodeId: Record<string, NodeOutputView>;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<"saved" | "dirty" | "saving">("saved");
  const lastSaved = useRef(initialTitle);
  const [, startTransition] = useTransition();

  function saveTitle() {
    const next = title.trim();
    if (next === lastSaved.current) {
      setStatus("saved");
      return;
    }
    // Title is required — an empty field reverts rather than saving a blank.
    if (next.length === 0) {
      setTitle(lastSaved.current);
      setStatus("saved");
      return;
    }
    startTransition(async () => {
      setStatus("saving");
      const r = await renameDraftAction(workflowId, next);
      if (r?.error) {
        toast.error(r.error);
        setStatus("dirty");
        return;
      }
      lastSaved.current = next;
      setStatus("saved");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-border border-b bg-background/60 px-4 py-3 backdrop-blur-xl">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#7c6bff] to-[#6d5ef0] text-white shadow-[0_6px_18px_rgba(109,94,240,0.35)]">
        <Workflow width={18} height={18} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span>Workflows</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate">{professionName ?? "Draft"}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
          <label className="group flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-border bg-foreground/[0.03] px-3 py-1.5 transition focus-within:border-primary/50 focus-within:bg-foreground/[0.06] focus-within:shadow-[0_0_0_3px_rgba(109,94,240,0.12)] sm:min-w-[340px]">
            <input
              type="text"
              value={title}
              placeholder="Untitled workflow"
              aria-label="Workflow title"
              className="min-w-0 flex-1 bg-transparent font-bold font-heading text-[16.5px] tracking-tight outline-none placeholder:text-muted-foreground/70"
              onChange={(e) => {
                setTitle(e.target.value);
                setStatus("dirty");
              }}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            />
            <Pencil
              width={14}
              height={14}
              aria-hidden="true"
              className="shrink-0 text-muted-foreground/60 group-focus-within:text-primary"
            />
          </label>
          <span
            className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground"
            aria-live="polite"
          >
            {status === "saved" ? (
              <>
                <Check
                  width={13}
                  height={13}
                  aria-hidden="true"
                  className="text-success"
                />
                Saved
              </>
            ) : status === "saving" ? (
              "Saving…"
            ) : (
              <>
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-warning"
                />
                Unsaved
              </>
            )}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <a
          href="#doctor"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 font-medium text-sm transition-colors hover:bg-accent"
        >
          <ShieldCheck width={15} height={15} aria-hidden="true" />
          <span className="hidden sm:inline">Review with Doctor</span>
        </a>
        <PublishBar
          workflowId={workflowId}
          nodes={nodes}
          outputsByNodeId={outputsByNodeId}
        />
      </div>
    </div>
  );
}
