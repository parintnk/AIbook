"use client";

import { Plus, SquarePen, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateHouseRulesAction } from "@/app/(app)/communities/[slug]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { houseRulesSchema, MAX_HOUSE_RULES } from "@/lib/profession-rules";
import type { HouseRule } from "@/lib/services/professions";
import styles from "./community.module.css";

/**
 * Story 7.3 — the mod-only "Edit house rules" affordance: a pencil button in the House-rules card
 * header (rendered ONLY when the viewer is a moderator) opening a Dialog that edits the profession's
 * `rules` jsonb. Validated with the SAME `houseRulesSchema` the server action re-checks (closes the
 * 7.2 review defer #3: trim + non-empty + cap). Members never see this — the rail doesn't render it
 * for non-mods (UX-DR21). Rows carry a stable client `_id` so add/remove doesn't scramble inputs.
 */
type Row = { _id: number; title: string; body: string };

export function EditRulesDialog({
  professionId,
  rules,
}: {
  professionId: string;
  rules: HouseRule[];
}) {
  const [open, setOpen] = useState(false);
  const seed = () => rules.map((r, i) => ({ _id: i, ...r }));
  const [draft, setDraft] = useState<Row[]>(seed);
  const nextId = useRef(rules.length);
  const [isPending, startTransition] = useTransition();

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setDraft(seed()); // discard edits on cancel/close
      nextId.current = rules.length;
    }
  }
  function setRow(id: number, patch: Partial<HouseRule>) {
    setDraft((d) => d.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setDraft((d) =>
      d.length >= MAX_HOUSE_RULES
        ? d
        : [...d, { _id: nextId.current++, title: "", body: "" }],
    );
  }
  function removeRow(id: number) {
    setDraft((d) => d.filter((r) => r._id !== id));
  }

  function save() {
    if (isPending) return;
    const parsed = houseRulesSchema.safeParse(
      draft.map((r) => ({ title: r.title.trim(), body: r.body.trim() })),
    );
    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ??
          "Give every rule a title and a description.",
      );
      return;
    }
    startTransition(async () => {
      const res = await updateHouseRulesAction(professionId, parsed.data);
      if (res.ok) {
        toast("House rules updated.");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <button
        type="button"
        className={styles.headBtn}
        onClick={() => setOpen(true)}
        aria-label="Edit house rules"
      >
        <SquarePen width={13} height={13} aria-hidden="true" />
        Edit
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit house rules</DialogTitle>
          <DialogDescription>
            The norms members see on the community home — keep them short and
            friendly.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2.5 px-4">
          {draft.map((r, i) => (
            <div
              key={r._id}
              className="flex flex-col gap-1.5 rounded-xl border border-border p-3"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={r.title}
                  onChange={(e) => setRow(r._id, { title: e.target.value })}
                  maxLength={80}
                  placeholder="Rule title (e.g. Show real output.)"
                  disabled={isPending}
                  aria-label={`Rule ${i + 1} title`}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeRow(r._id)}
                  disabled={isPending}
                  aria-label={`Remove rule ${i + 1}`}
                >
                  <Trash2 width={15} height={15} />
                </Button>
              </div>
              <Textarea
                value={r.body}
                onChange={(e) => setRow(r._id, { body: e.target.value })}
                maxLength={200}
                rows={2}
                placeholder="A short description of the norm."
                disabled={isPending}
                aria-label={`Rule ${i + 1} description`}
              />
            </div>
          ))}
          {draft.length < MAX_HOUSE_RULES ? (
            <Button
              variant="outline"
              size="sm"
              onClick={addRow}
              disabled={isPending}
              className="self-start"
            >
              <Plus width={15} height={15} /> Add rule
            </Button>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost" disabled={isPending} />}>
            Cancel
          </DialogClose>
          <Button disabled={isPending || draft.length === 0} onClick={save}>
            {isPending ? "Saving…" : "Save rules"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
