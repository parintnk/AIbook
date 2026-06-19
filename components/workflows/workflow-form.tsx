"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Check, Pencil, Workflow } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
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
 * Create or edit a workflow draft (Story 2.1). Two layouts share one react-hook-form:
 * `variant="full"` (the /new create page) is the labelled card form; `variant="editor"`
 * (the /edit page) is the mockup's editbar — an inline title field + a collapsible
 * "Workflow details" disclosure — so the canvas owns the page and metadata tucks away.
 * Create redirects to /workflows on success; edit stays put (updateDraftAction no longer
 * redirects) and toasts + refreshes so the canvas keeps its place.
 */
export function WorkflowForm({
  professions,
  allTags,
  draftId,
  defaultValues,
  variant = "full",
  professionName,
  actionsSlot,
}: {
  professions: ProfessionOption[];
  allTags: Tag[];
  draftId?: string;
  defaultValues?: WorkflowDraftValues;
  /** "full" = labelled card (create); "editor" = editbar + details disclosure (edit). */
  variant?: "full" | "editor";
  /** Current profession name, for the editor breadcrumb (edit only). */
  professionName?: string | null;
  /** Editbar right-side actions (Review + Publish), rendered by the page (edit only). */
  actionsSlot?: ReactNode;
}) {
  const isEdit = Boolean(draftId);
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
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
      // Create redirects on success (only errors come back). Edit returns success and
      // stays put — reset() clears the dirty state so the autosave indicator reads "Saved".
      if (result?.error) {
        setServerError(result.error);
        toast.error(result.error);
      } else if (result?.success) {
        reset(values);
        setSavedAt(true);
        toast.success("Saved.");
        router.refresh();
      }
    });
  }

  // ── Shared detail fields (summary / profession / tags) ────────────────────
  const detailFields = (
    <>
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
    </>
  );

  // ── Editor variant (edit page) — editbar + collapsible details ────────────
  if (variant === "editor") {
    // Dirty after first edit; clean (or freshly saved) → "Saved".
    const showSaved = !isDirty || savedAt;
    return (
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-border bg-background/85 px-4 py-3 shadow-sm backdrop-blur-xl">
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
                  placeholder="Untitled workflow"
                  aria-label="Workflow title"
                  aria-invalid={errors.title ? true : undefined}
                  className="min-w-0 flex-1 bg-transparent font-bold font-heading text-[16.5px] tracking-tight outline-none placeholder:text-muted-foreground/70"
                  {...register("title")}
                />
                <Pencil
                  width={14}
                  height={14}
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground/60 group-focus-within:text-primary"
                />
              </label>
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                {showSaved ? (
                  <>
                    <Check
                      width={13}
                      height={13}
                      aria-hidden="true"
                      className="text-success"
                    />
                    Saved
                  </>
                ) : (
                  <>
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-warning"
                    />
                    Unsaved changes
                  </>
                )}
              </span>
            </div>
            <FieldError id="title-error" message={errors.title?.message} />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-9"
              disabled={isPending || !isDirty}
            >
              {isPending ? "Saving…" : "Save changes"}
            </Button>
            {actionsSlot}
          </div>
        </div>

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
          <div className="flex flex-col gap-4 border-border border-t px-5 py-5">
            {detailFields}
          </div>
        </details>

        {serverError ? (
          <p
            className="mt-3 text-sm text-destructive"
            role="alert"
            aria-live="assertive"
          >
            {serverError}
          </p>
        ) : null}
      </form>
    );
  }

  // ── Full variant (create page) — labelled card ────────────────────────────
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

        {detailFields}
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
