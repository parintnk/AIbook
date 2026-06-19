"use client";

import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateDraftDetailsAction } from "@/app/(app)/workflows/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
 * "Workflow details" as an editbar Dialog (summary / profession / tags) — the mockup
 * keeps metadata OFF the full-screen canvas surface. Title is autosaved separately in
 * the editbar, so this never carries it.
 *
 * NOTE: controlled `useState` + onClick (NOT react-hook-form + a native form submit) —
 * base-ui Dialog's portal doesn't fire form submits, so this follows the proven dialog
 * pattern. See [[base-ui-dialog-submit-gotcha]].
 */
export function WorkflowDetailsDialog({
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
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(defaultValues.summary);
  const [professionId, setProfessionId] = useState(defaultValues.profession_id);
  const [tags, setTags] = useState<string[]>(defaultValues.tags);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function toggleTag(id: string) {
    setTags((prev) =>
      prev.includes(id)
        ? prev.filter((t) => t !== id)
        : prev.length < MAX_TAGS
          ? [...prev, id]
          : prev,
    );
  }

  function submit() {
    if (isPending) return;
    const parsed = workflowDetailsSchema.safeParse({
      summary,
      profession_id: professionId,
      tags,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await updateDraftDetailsAction(workflowId, parsed.data);
      if (result?.error) {
        toast.error(result.error);
      } else if (result?.success) {
        toast.success("Details saved.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 font-medium text-sm transition-colors hover:bg-accent">
        <SlidersHorizontal width={15} height={15} aria-hidden="true" />
        <span className="hidden sm:inline">Details</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Workflow details</DialogTitle>
          <DialogDescription>
            Summary, profession, and tags — how people find this. The title is
            edited (and autosaved) up in the editbar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="A sentence on what this workflow does."
              aria-invalid={errors.summary ? true : undefined}
              aria-describedby={errors.summary ? "summary-error" : undefined}
            />
            <FieldError id="summary-error" message={errors.summary} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profession_id">Profession</Label>
            <select
              id="profession_id"
              value={professionId}
              onChange={(e) => setProfessionId(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              aria-invalid={errors.profession_id ? true : undefined}
              aria-describedby={
                errors.profession_id ? "profession_id-error" : undefined
              }
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
              message={errors.profession_id}
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
                  const on = tags.includes(t.id);
                  const atMax = !on && tags.length >= MAX_TAGS;
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
            <FieldError id="tags-error" message={errors.tags} />
          </fieldset>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" onClick={submit} disabled={isPending}>
              {isPending ? "Saving…" : "Save details"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
