"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteNodeAction } from "@/app/(app)/workflows/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import type { WorkflowNodeValues } from "@/lib/validation/workflow";
import { NodeForm } from "./node-form";
import { RecipeCard } from "./recipe-card";

type EditingState =
  | { mode: "new" }
  | { mode: "edit"; node: WorkflowNode }
  | null;

/** Map a stored node to the form's string-only values (nulls → ""). */
function nodeToValues(node: WorkflowNode): WorkflowNodeValues {
  return {
    step_title: node.step_title ?? "",
    tool_name: node.tool_name,
    tool_version: node.tool_version ?? "",
    est_time: node.est_time ?? "",
    prompt: node.prompt,
    purpose: node.purpose,
    est_cost: node.est_cost ?? "",
    tool_url: node.tool_url ?? "",
    notes: node.notes ?? "",
    note_lang: node.note_lang ?? "",
  };
}

/**
 * The "Steps" section of the draft editor (Story 2.2) — the UX-DR22 linear step
 * list (a first-class a11y/mobile surface; the Story 2.3 canvas augments it). It
 * owns the client interaction state (which card is selected, which one is being
 * edited) and renders the shared RecipeCard in editor mode + the NodeForm in a
 * Sheet. Data comes from the RSC page; mutations go through the node actions.
 */
export function WorkflowSteps({
  workflowId,
  nodes,
  outputsByNodeId,
  hideHeader = false,
}: {
  workflowId: string;
  nodes: WorkflowNode[];
  outputsByNodeId: Record<string, NodeOutputView>;
  /** When the editor surface already renders the "Steps" heading (Story 2.3). */
  hideHeader?: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState>(null);

  function closeForm() {
    setEditing(null);
    router.refresh();
  }

  async function onDelete(node: WorkflowNode) {
    if (!window.confirm(`Delete step ${node.idx + 1}? This can't be undone.`))
      return;
    const result = await deleteNodeAction(workflowId, node.id);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Step deleted.");
      if (selectedId === node.id) setSelectedId(null);
    }
    router.refresh();
  }

  return (
    <section className={hideHeader ? "" : "mt-10"}>
      {hideHeader ? (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => setEditing({ mode: "new" })}
            className="shrink-0"
          >
            + Add step
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-bold tracking-tight">
              Steps
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The recipe — one card per tool + prompt.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setEditing({ mode: "new" })}
            className="shrink-0"
          >
            + Add step
          </Button>
        </div>
      )}

      {nodes.length === 0 ? (
        <div className="glass mt-6 flex flex-col items-center gap-3 rounded-card py-12 text-center">
          <p className="text-muted-foreground">
            No steps yet. Add the first step of your workflow.
          </p>
          <Button type="button" onClick={() => setEditing({ mode: "new" })}>
            + Add step
          </Button>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {nodes.map((node) => (
            <li key={node.id}>
              <RecipeCard
                node={node}
                output={outputsByNodeId[node.id] ?? null}
                mode="editor"
                selected={selectedId === node.id}
                onSelect={() => setSelectedId(node.id)}
                onEdit={() => setEditing({ mode: "edit", node })}
                onDelete={() => onDelete(node)}
              />
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editing?.mode === "edit" ? "Edit step" : "Add step"}
            </SheetTitle>
            <SheetDescription>
              {editing?.mode === "edit"
                ? "Update this recipe card."
                : "Add a tool + prompt step to your workflow."}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {editing ? (
              <NodeForm
                // Remount per target so RHF re-seeds defaultValues (it only reads
                // them on mount) when switching between add / editing a node.
                key={editing.mode === "edit" ? editing.node.id : "new"}
                workflowId={workflowId}
                nodeId={editing.mode === "edit" ? editing.node.id : undefined}
                defaultValues={
                  editing.mode === "edit"
                    ? nodeToValues(editing.node)
                    : undefined
                }
                output={
                  editing.mode === "edit"
                    ? (outputsByNodeId[editing.node.id] ?? null)
                    : null
                }
                onDone={closeForm}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
