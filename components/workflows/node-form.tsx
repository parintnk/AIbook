"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  createNodeAction,
  updateNodeAction,
} from "@/app/(app)/workflows/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type WorkflowNodeValues,
  workflowNodeSchema,
} from "@/lib/validation/workflow";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive" aria-live="polite">
      {message}
    </p>
  );
}

const EMPTY: WorkflowNodeValues = {
  step_title: "",
  tool_name: "",
  tool_version: "",
  est_time: "",
  prompt: "",
  purpose: "",
  est_cost: "",
  tool_url: "",
  notes: "",
  note_lang: "",
};

/**
 * Add or edit a recipe-card node (Story 2.2 / FR6). Create and edit share this
 * form; `nodeId` switches to edit mode. The node actions don't redirect (editing
 * is inline), so on success we toast + call `onDone` (the parent closes the form
 * and refreshes the server-rendered step list).
 */
export function NodeForm({
  workflowId,
  nodeId,
  defaultValues,
  onDone,
}: {
  workflowId: string;
  nodeId?: string;
  defaultValues?: WorkflowNodeValues;
  onDone?: () => void;
}) {
  const isEdit = Boolean(nodeId);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkflowNodeValues>({
    resolver: standardSchemaResolver(workflowNodeSchema),
    mode: "onBlur",
    defaultValues: defaultValues ?? EMPTY,
  });

  function onSubmit(values: WorkflowNodeValues) {
    setServerError(null);
    startTransition(async () => {
      const result =
        isEdit && nodeId
          ? await updateNodeAction(workflowId, nodeId, values)
          : await createNodeAction(workflowId, values);
      if (result?.error) {
        setServerError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Step updated." : "Step added.");
      onDone?.();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="step_title">Step title</Label>
        <Input
          id="step_title"
          placeholder="e.g. Define brand direction"
          aria-invalid={errors.step_title ? true : undefined}
          aria-describedby={errors.step_title ? "step_title-error" : undefined}
          {...register("step_title")}
        />
        <FieldError
          id="step_title-error"
          message={errors.step_title?.message}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tool_name">Tool *</Label>
          <Input
            id="tool_name"
            placeholder="e.g. ChatGPT"
            aria-invalid={errors.tool_name ? true : undefined}
            aria-describedby={errors.tool_name ? "tool_name-error" : undefined}
            {...register("tool_name")}
          />
          <FieldError
            id="tool_name-error"
            message={errors.tool_name?.message}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tool_version">Version</Label>
          <Input
            id="tool_version"
            placeholder="e.g. 4o"
            className="sm:w-28"
            aria-invalid={errors.tool_version ? true : undefined}
            aria-describedby={
              errors.tool_version ? "tool_version-error" : undefined
            }
            {...register("tool_version")}
          />
          <FieldError
            id="tool_version-error"
            message={errors.tool_version?.message}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="est_time">Est. time</Label>
        <Input
          id="est_time"
          placeholder="e.g. ~5 min"
          aria-invalid={errors.est_time ? true : undefined}
          aria-describedby={errors.est_time ? "est_time-error" : undefined}
          {...register("est_time")}
        />
        <FieldError id="est_time-error" message={errors.est_time?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prompt">Prompt *</Label>
        <Textarea
          id="prompt"
          rows={5}
          className="font-mono text-[13px] leading-relaxed"
          placeholder="The exact prompt or instruction for this step."
          aria-invalid={errors.prompt ? true : undefined}
          aria-describedby={errors.prompt ? "prompt-error" : undefined}
          {...register("prompt")}
        />
        <FieldError id="prompt-error" message={errors.prompt?.message} />
      </div>

      {/* Sample output is uploaded in a later update (Story 2.4) — stub for now. */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Sample output</span>
        <p className="rounded-lg border border-dashed border-border/70 bg-foreground/[0.02] px-3 py-2.5 text-sm text-muted-foreground">
          You'll be able to attach a sample output here in a later update.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="purpose">Purpose *</Label>
        <Textarea
          id="purpose"
          rows={2}
          placeholder="Why this step exists / what it accomplishes."
          aria-invalid={errors.purpose ? true : undefined}
          aria-describedby={errors.purpose ? "purpose-error" : undefined}
          {...register("purpose")}
        />
        <FieldError id="purpose-error" message={errors.purpose?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="est_cost">Est. cost</Label>
        <Input
          id="est_cost"
          placeholder="e.g. $0.02"
          aria-invalid={errors.est_cost ? true : undefined}
          aria-describedby={errors.est_cost ? "est_cost-error" : undefined}
          {...register("est_cost")}
        />
        <FieldError id="est_cost-error" message={errors.est_cost?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tool_url">Tool URL</Label>
        <Input
          id="tool_url"
          inputMode="url"
          placeholder="https://…"
          aria-invalid={errors.tool_url ? true : undefined}
          aria-describedby={errors.tool_url ? "tool_url-error" : undefined}
          {...register("tool_url")}
        />
        <FieldError id="tool_url-error" message={errors.tool_url?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={2}
          placeholder="Tips or gotchas — your own language is fine."
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={errors.notes ? "notes-error" : undefined}
          {...register("notes")}
        />
        <FieldError id="notes-error" message={errors.notes?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note_lang">Note language</Label>
        <Input
          id="note_lang"
          placeholder="e.g. th, en"
          className="sm:w-32"
          aria-invalid={errors.note_lang ? true : undefined}
          aria-describedby={errors.note_lang ? "note_lang-error" : undefined}
          {...register("note_lang")}
        />
        <FieldError id="note_lang-error" message={errors.note_lang?.message} />
      </div>

      {serverError ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          aria-live="assertive"
        >
          {serverError}
        </p>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save step" : "Add step"}
        </Button>
        {onDone ? (
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={onDone}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
