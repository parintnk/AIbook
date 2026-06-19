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
import type { Tag } from "@/lib/explore";
import {
  type WorkflowDraftValues,
  workflowDraftSchema,
} from "@/lib/validation/workflow";

/** Max tags per workflow (mirrors `workflowDraftSchema.tags.max(6)`). */
const MAX_TAGS = 6;

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
  allTags,
  draftId,
  defaultValues,
}: {
  professions: ProfessionOption[];
  allTags: Tag[];
  draftId?: string;
  defaultValues?: WorkflowDraftValues;
}) {
  const isEdit = Boolean(draftId);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WorkflowDraftValues>({
    resolver: standardSchemaResolver(workflowDraftSchema),
    mode: "onBlur",
    defaultValues: defaultValues ?? {
      title: "",
      summary: "",
      profession_id: "",
      tags: [],
    },
  });

  // `tags` is a controlled array field (toggle chips) — RHF tracks it via watch/setValue.
  const selectedTags = watch("tags") ?? [];
  function toggleTag(id: string) {
    const next = selectedTags.includes(id)
      ? selectedTags.filter((t) => t !== id)
      : selectedTags.length < MAX_TAGS
        ? [...selectedTags, id]
        : selectedTags;
    setValue("tags", next, { shouldDirty: true });
  }

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

        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="font-medium text-sm">Tags</legend>
          <p className="text-sm text-muted-foreground">
            Add up to {MAX_TAGS} so people can find this in their profession.
          </p>
          {allTags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tags available yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allTags.map((t) => {
                const on = selectedTags.includes(t.id);
                const atMax = !on && selectedTags.length >= MAX_TAGS;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    disabled={atMax}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-muted-foreground hover:border-ring"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
          <FieldError id="tags-error" message={errors.tags?.message} />
        </fieldset>
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
        <Button
          type="submit"
          size="lg"
          className="h-11 bg-gradient-to-br from-[#7c6bff] to-[#6d5ef0] shadow-[0_8px_20px_rgba(109,94,240,0.28)] hover:brightness-[1.04]"
          disabled={isPending}
        >
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
