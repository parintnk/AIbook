"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  createDraftAction,
  updateDraftAction,
} from "@/app/(app)/workflows/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type WorkflowDraftValues,
  workflowDraftSchema,
} from "@/lib/validation/workflow";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive" aria-live="polite">
      {message}
    </p>
  );
}

export type ProfessionOption = { id: string; name: string };

/**
 * Create or edit a workflow draft (Story 2.1). Create and edit share this form;
 * `draftId` switches to edit mode. On success the server action redirects to
 * /workflows, so only errors return to the client.
 */
export function WorkflowForm({
  professions,
  draftId,
  defaultValues,
}: {
  professions: ProfessionOption[];
  draftId?: string;
  defaultValues?: WorkflowDraftValues;
}) {
  const isEdit = Boolean(draftId);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkflowDraftValues>({
    resolver: standardSchemaResolver(workflowDraftSchema),
    mode: "onBlur",
    defaultValues: defaultValues ?? {
      title: "",
      summary: "",
      profession_id: "",
    },
  });

  function onSubmit(values: WorkflowDraftValues) {
    setServerError(null);
    startTransition(async () => {
      const result =
        isEdit && draftId
          ? await updateDraftAction(draftId, values)
          : await createDraftAction(values);
      // On success the action redirects; only errors come back here.
      if (result?.error) {
        setServerError(result.error);
        toast.error(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-6"
    >
      <section className="glass flex flex-col gap-4 rounded-card p-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="e.g. Product launch carousel"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? "title-error" : undefined}
            {...register("title")}
          />
          <FieldError id="title-error" message={errors.title?.message} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="summary">Summary</Label>
          <Textarea
            id="summary"
            rows={3}
            placeholder="A sentence on what this workflow does."
            aria-invalid={errors.summary ? true : undefined}
            aria-describedby={errors.summary ? "summary-error" : undefined}
            {...register("summary")}
          />
          <FieldError id="summary-error" message={errors.summary?.message} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profession_id">Profession</Label>
          <select
            id="profession_id"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            aria-invalid={errors.profession_id ? true : undefined}
            aria-describedby={
              errors.profession_id ? "profession_id-error" : undefined
            }
            {...register("profession_id")}
          >
            <option value="">Pick a profession…</option>
            {professions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <FieldError
            id="profession_id-error"
            message={errors.profession_id?.message}
          />
        </div>
      </section>

      {serverError ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          aria-live="assertive"
        >
          {serverError}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" className="h-11" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
