"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateDraftDetailsAction } from "@/app/(app)/workflows/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tag } from "@/lib/explore";
import {
  type WorkflowDetailsValues,
  workflowDetailsSchema,
} from "@/lib/validation/workflow";
import type { ProfessionOption } from "./workflow-form";

const MAX_TAGS = 6;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive" aria-live="polite">
      {message}
    </p>
  );
}

/**
 * The editor's "Workflow details" disclosure (mockup keeps metadata OFF the canvas
 * surface). Summary / profession / tags only — the title autosaves in the editbar.
 * Collapsed by default below the fused editor; saves via `updateDraftDetailsAction`
 * (no redirect) then toasts + refreshes so the breadcrumb/skeleton profession re-sync.
 */
export function WorkflowDetailsForm({
  workflowId,
  professions,
  allTags,
  defaultValues,
}: {
  workflowId: string;
  professions: ProfessionOption[];
  allTags: Tag[];
  defaultValues: WorkflowDetailsValues;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<WorkflowDetailsValues>({
    resolver: standardSchemaResolver(workflowDetailsSchema),
    mode: "onBlur",
    defaultValues,
  });

  const selectedTags = watch("tags") ?? [];
  function toggleTag(id: string) {
    const next = selectedTags.includes(id)
      ? selectedTags.filter((t) => t !== id)
      : selectedTags.length < MAX_TAGS
        ? [...selectedTags, id]
        : selectedTags;
    setValue("tags", next, { shouldDirty: true });
  }

  function onSubmit(values: WorkflowDetailsValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateDraftDetailsAction(workflowId, values);
      if (result?.error) {
        setServerError(result.error);
        toast.error(result.error);
      } else if (result?.success) {
        toast.success("Details saved.");
        router.refresh();
      }
    });
  }

  return (
    <details className="group mt-4 overflow-hidden rounded-card border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 font-medium text-sm transition-colors hover:bg-foreground/[0.02]">
        <span className="flex items-center gap-2">
          Workflow details
          <span className="font-normal text-muted-foreground text-xs">
            summary · profession · tags
          </span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-muted-foreground transition-transform group-open:rotate-180"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4 border-border border-t px-5 py-5"
      >
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

        {serverError ? (
          <p
            className="text-sm text-destructive"
            role="alert"
            aria-live="assertive"
          >
            {serverError}
          </p>
        ) : null}

        <div>
          <Button type="submit" size="sm" disabled={isPending || !isDirty}>
            {isPending ? "Saving…" : "Save details"}
          </Button>
        </div>
      </form>
    </details>
  );
}
