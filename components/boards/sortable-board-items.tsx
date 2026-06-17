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
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bookmark,
  Check,
  ChevronDown,
  GitFork,
  GripVertical,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  loadMoreBoardItemsAction,
  removeBoardItemAction,
  reorderBoardItemsAction,
  saveToBoardAction,
} from "@/app/(app)/boards/actions";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import exploreStyles from "@/components/workflows/explore.module.css";
import { WorkflowThumb } from "@/components/workflows/workflow-thumb";
import { type WorkflowCardData, workedPct } from "@/lib/explore";
import { cn } from "@/lib/utils";
import styles from "./boards.module.css";

/**
 * Story 8.2 — the OWNER's editable board grid: drag-reorder (@dnd-kit, pointer + keyboard) + a
 * per-card Remove (the savemark). Optimistic with revert-on-failure + toast + `isPending` guard +
 * `useEffect` resync (the 7.3 sortable-canon pattern). Paginated (AC2); reorder persists
 * `sort_order` over the loaded items. Cards reuse the explore `.wfcard` family; the drag handle +
 * remove are SIBLING overlays of the whole-card `<Link>` (the 8.1 no-navigate rule).
 */
export function SortableBoardItems({
  boardId,
  initialItems,
  total,
}: {
  boardId: string;
  initialItems: WorkflowCardData[];
  total: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  useEffect(() => setItems(initialItems), [initialItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const allLoaded = items.length >= total;

  function onDragEnd(e: DragEndEvent) {
    if (isPending) return; // in-flight guard (4.2/7.3 lesson)
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((w) => w.id === active.id);
    const newIndex = items.findIndex((w) => w.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const prev = items;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next); // optimistic
    startTransition(async () => {
      const res = await reorderBoardItemsAction(
        boardId,
        next.map((w) => w.id),
      );
      if (!res.ok) {
        setItems(prev); // revert
        toast.error(res.error);
      }
    });
  }

  function remove(id: string, title: string) {
    if (isPending) return;
    const prev = items;
    setItems((it) => it.filter((w) => w.id !== id)); // optimistic
    startTransition(async () => {
      const res = await removeBoardItemAction(boardId, id);
      if (res.ok) {
        toast(`Removed "${title}".`, {
          action: {
            label: "Undo",
            onClick: () =>
              startTransition(async () => {
                const back = await saveToBoardAction(boardId, id);
                if (back.ok) setItems(prev);
                else toast.error(back.error);
              }),
          },
        });
      } else {
        setItems(prev); // revert
        toast.error(res.error);
      }
    });
  }

  function loadMore() {
    startTransition(async () => {
      const res = await loadMoreBoardItemsAction(boardId, items.length);
      setItems((p) => [...p, ...res.items]);
    });
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((w) => w.id)}
          strategy={rectSortingStrategy}
        >
          <div className={exploreStyles.feedgrid}>
            {items.map((w) => (
              <SortableCard
                key={w.id}
                w={w}
                onRemove={() => remove(w.id, w.title)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className={exploreStyles.loadmore}>
        <div className={exploreStyles.count} aria-live="polite">
          {allLoaded ? (
            "You're all caught up"
          ) : (
            <>
              Showing <span className={exploreStyles.mono}>{items.length}</span>{" "}
              of <span className={exploreStyles.mono}>{total}</span>
            </>
          )}
        </div>
        {allLoaded ? null : (
          <button
            type="button"
            className={exploreStyles.loadBtn}
            onClick={loadMore}
            disabled={isPending}
          >
            {isPending ? "Loading…" : "Load more"}
            <ChevronDown width={16} height={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  );
}

function SortableCard({
  w,
  onRemove,
}: {
  w: WorkflowCardData;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: w.id });
  const pct = workedPct(w.workedScore, w.triedCount);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(exploreStyles.wfcardWrap, isDragging && styles.dragging)}
    >
      <Link href={`/workflows/${w.id}`} className={exploreStyles.wfcard}>
        <WorkflowThumb id={w.id} thumb={w.thumb} />
        <h3 className={exploreStyles.wfTitle}>{w.title}</h3>
        <div className={exploreStyles.wauth}>
          {w.authorHandle ? (
            <>
              <ProfileAvatar
                avatarUrl={w.authorAvatarUrl}
                displayName={w.authorDisplayName}
                handle={w.authorHandle}
                className={exploreStyles.av}
              />
              <span className={exploreStyles.h}>@{w.authorHandle}</span>
            </>
          ) : null}
          {w.professionName ? (
            <span className={exploreStyles.commchip}>{w.professionName}</span>
          ) : null}
        </div>
        <div className={exploreStyles.wstats}>
          <span className={exploreStyles.statchip}>
            <GitFork width={13} height={13} aria-hidden="true" />{" "}
            <b className={exploreStyles.mono}>{w.forkCount}</b> forks
          </span>
          {pct !== null ? (
            <span className={exploreStyles.score}>
              <Check
                width={12}
                height={12}
                strokeWidth={2.4}
                aria-hidden="true"
              />
              {pct}% worked
            </span>
          ) : null}
        </div>
      </Link>
      <button
        type="button"
        className={styles.draghandle}
        aria-label={`Reorder ${w.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical width={14} height={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.removeMark}
        onClick={onRemove}
        aria-label={`Remove ${w.title} from board`}
        title="Remove from board"
      >
        <Bookmark width={14} height={14} aria-hidden="true" />
      </button>
    </div>
  );
}
