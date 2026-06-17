"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  reorderPinsAction,
  unpinWorkflowAction,
} from "@/app/(app)/communities/[slug]/actions";
import type { ProfessionPin } from "@/lib/services/professions";
import styles from "./community.module.css";

/**
 * Story 7.3 — the mod-only editable "Start here" canon: keyboard- + pointer-accessible drag-reorder
 * (@dnd-kit) plus per-row unpin. Optimistic with revert-on-failure + toast (the 4.3 reports-queue
 * pattern). Rendered ONLY for moderators; members get the plain read-only `<Link>` list in the rail
 * (UX-DR21 — the @dnd-kit bundle never loads for them). Re-syncs to the server canon after a
 * pin/unpin/reorder revalidate.
 */
export function SortableCanon({
  professionId,
  canon,
}: {
  professionId: string;
  canon: ProfessionPin[];
}) {
  const [items, setItems] = useState(canon);
  const [isPending, startTransition] = useTransition();
  // Re-sync when the server canon changes (revalidatePath after a mutation = the source of truth).
  useEffect(() => {
    setItems(canon);
  }, [canon]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (isPending) return; // in-flight guard — don't overlap optimistic transitions (4.2 lesson)
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((w) => w.id === active.id);
    const newIndex = items.findIndex((w) => w.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const prev = items;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next); // optimistic
    startTransition(async () => {
      const res = await reorderPinsAction(
        professionId,
        next.map((w) => w.id),
      );
      if (!res.ok) {
        setItems(prev); // revert
        toast.error(res.error);
      }
    });
  }

  function unpin(id: string, title: string) {
    if (isPending) return; // in-flight guard (the drag handle isn't disabled, so a drag could race)
    const prev = items;
    setItems((it) => it.filter((w) => w.id !== id)); // optimistic
    startTransition(async () => {
      const res = await unpinWorkflowAction(professionId, id);
      if (res.ok) {
        toast(`Unpinned "${title}".`);
      } else {
        setItems(prev); // revert
        toast.error(res.error);
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((w) => w.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className={styles.canon}>
          {items.map((w, i) => (
            <SortableRow
              key={w.id}
              w={w}
              index={i}
              onUnpin={() => unpin(w.id, w.title)}
              disabled={isPending}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  w,
  index,
  onUnpin,
  disabled,
}: {
  w: ProfessionPin;
  index: number;
  onUnpin: () => void;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: w.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${styles.canonRow} ${isDragging ? styles.dragging : ""}`}
    >
      <button
        type="button"
        className={styles.dragHandle}
        aria-label={`Reorder ${w.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical width={15} height={15} aria-hidden="true" />
      </button>
      <span className={`${styles.cnum} font-mono`}>{index + 1}</span>
      <Link href={`/workflows/${w.id}`} className={styles.canonTitle}>
        {w.title}
      </Link>
      <button
        type="button"
        className={styles.unpinBtn}
        onClick={onUnpin}
        disabled={disabled}
        aria-label={`Unpin ${w.title}`}
      >
        <X width={15} height={15} aria-hidden="true" />
      </button>
    </li>
  );
}
