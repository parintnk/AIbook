"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createDraftAction } from "@/app/(app)/workflows/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tag } from "@/lib/explore";
import { workflowDraftSchema } from "@/lib/validation/workflow";

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
 * Create a new workflow draft (Story 2.1) — the fields for the /new "New workflow"
 * dialog (`NewWorkflowDialog`). On success `createDraftAction` returns the id and the
 * client navigates into the new draft's editor.
 *
 * NOTE: controlled `useState` + an onClick submit (NOT react-hook-form + a native
 * `<form>` submit). base-ui Dialog renders its content in a portal that doesn't fire
 * native form submission, so the proven in-dialog pattern (ReportDialog / NewBoardButton)
 * is local state + a button onClick — see [[base-ui-dialog-submit-gotcha]].
 */
export function WorkflowForm({
  professions,
  allTags,
  onCreated,
}: {
  professions: ProfessionOption[];
  allTags: Tag[];
  /** Called with the new draft id on success; defaults to navigating into its editor. */
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [professionId, setProfessionId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
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
    const parsed = workflowDraftSchema.safeParse({
      title,
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
      const result = await createDraftAction(parsed.data);
      if (result?.error) {
        toast.error(result.error);
      } else if (result?.success && result.id) {
        if (onCreated) onCreated(result.id);
        else router.push(`/workflows/${result.id}/edit`);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Product launch carousel"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? "title-error" : undefined}
          />
          <FieldError id="title-error" message={errors.title} />
        </div>

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
          <FieldError id="profession_id-error" message={errors.profession_id} />
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
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="lg"
          onClick={submit}
          className="h-11 bg-gradient-to-br from-[#7c6bff] to-[#6d5ef0] shadow-[0_8px_20px_rgba(109,94,240,0.28)] hover:brightness-[1.04]"
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Create draft"}
        </Button>
      </div>
    </div>
  );
}
