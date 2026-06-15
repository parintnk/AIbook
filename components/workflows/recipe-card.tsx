"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { cn } from "@/lib/utils";
import { OutputPreview } from "./output-preview";

/**
 * The recipe-card node — the single source of truth for how a workflow step is
 * shown (FR6 / UX-DR5). ONE component, two modes:
 *  - `viewer`: click to expand the read-only details, hover lifts. Reused by the
 *    Epic 3 workflow viewer and the Epic 5 lineage tree.
 *  - `editor`: click selects (accent ring), double-click / Enter (when selected)
 *    opens the inline editor; selecting reveals Edit / Delete.
 * It is purely presentational — all data + mutations live in the service/actions;
 * the parent passes the node and the editor callbacks. The output thumbnail slot
 * is an empty stub here; Story 2.4 fills it from `node_outputs`.
 */

const OUTPUT_KIND_LABEL: Record<string, string> = {
  image: "Image",
  video: "Video",
  text: "Text",
  file: "File",
};

export type RecipeCardProps = {
  node: WorkflowNode;
  /** The node's sample output (Story 2.4) — drives the compact indicator. */
  output?: NodeOutputView | null;
  mode: "viewer" | "editor";
  /** editor: this card is the selected one (accent ring + Edit/Delete shown). */
  selected?: boolean;
  /** editor: single-click selects this node. */
  onSelect?: () => void;
  /** editor: double-click / Enter (when selected) / the Edit button → edit. */
  onEdit?: () => void;
  /** editor: the Delete button. */
  onDelete?: () => void;
  /**
   * The publish-blocked (missing sample output) amber state. Wired in Story 2.5;
   * accepted now so the shared component is forward-compatible.
   */
  blocked?: boolean;
  className?: string;
};

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * Only http(s) URLs may become real links. This is the render-side guard for the
 * shared component: a `javascript:`/`data:` URL that reached the DB outside the
 * Zod `urlOrEmpty` validator (e.g. a direct PostgREST write — the threat model the
 * harden migration defends against) must never render as a clickable href once
 * this card is shown on the public viewer (Epic 3) / lineage (Epic 5).
 */
function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** A small warning triangle — the non-color a11y signal for the blocked state. */
function WarningTriangle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function RecipeCard({
  node,
  output = null,
  mode,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
  blocked = false,
  className,
}: RecipeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isEditor = mode === "editor";
  const detailsOpen = isEditor ? selected : expanded;

  function onFaceClick() {
    if (isEditor) onSelect?.();
    else setExpanded((v) => !v);
  }

  return (
    <div
      className={cn(
        "glass overflow-hidden rounded-node ring-1 ring-foreground/10 transition",
        !isEditor && "hover:-translate-y-0.5 hover:shadow-lg",
        selected &&
          "ring-2 ring-accent-foreground/50 shadow-[0_10px_30px_-12px_var(--accent-foreground)]",
        // The mockup `.node.draft` amber outline — but the accent selection ring
        // wins when a blocked card is also selected.
        blocked &&
          !selected &&
          "ring-2 ring-warning/60 shadow-[0_10px_26px_-12px_var(--warning)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={onFaceClick}
        onDoubleClick={isEditor ? onEdit : undefined}
        onKeyDown={
          isEditor
            ? (e) => {
                // Enter on the already-selected card opens the editor (AC2). The
                // native click still fires onSelect harmlessly (already selected).
                if (e.key === "Enter" && selected) onEdit?.();
              }
            : undefined
        }
        aria-pressed={isEditor ? selected : undefined}
        aria-expanded={detailsOpen}
        className="flex w-full flex-col p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {/* Header: step number + title (left), est. time (right) */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 text-sm font-semibold tracking-tight">
            <span className="text-accent-foreground">{node.idx + 1}</span>
            {node.step_title ? (
              <span className="text-foreground"> · {node.step_title}</span>
            ) : null}
          </div>
          {node.est_time ? (
            <span className="shrink-0 rounded-md border border-border/60 bg-foreground/[0.04] px-2 py-0.5 font-mono text-[10.5px] font-medium text-muted-foreground">
              {node.est_time}
            </span>
          ) : null}
        </div>

        {/* Tool chip (mono, accent-tinted, vendor-neutral gradient glyph) */}
        <span className="mt-2.5 inline-flex items-center gap-1.5 self-start rounded-md border border-accent-foreground/20 bg-accent px-2.5 py-1 font-mono text-[11px] font-semibold text-accent-foreground">
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-[5px] bg-gradient-to-br from-accent-foreground to-accent-foreground/40"
          />
          {node.tool_name}
        </span>

        {/* Collapsed content: a prompt preview + a compact sample-output indicator
            (Story 2.4). Hidden once details open. */}
        {!detailsOpen ? (
          <>
            <span className="mt-2.5 line-clamp-2 rounded-lg border border-border/60 bg-foreground/[0.02] px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
              {node.prompt}
            </span>
            <span className="mt-2 inline-flex items-center gap-1.5 self-start text-[11px] text-muted-foreground">
              {output ? (
                <>
                  {output.kind === "image" && output.thumbUrl ? (
                    // biome-ignore lint/performance/noImgElement: signed CDN thumbnail, not a static asset
                    <img
                      src={output.thumbUrl}
                      alt=""
                      className="size-6 rounded border border-border/60 object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full bg-success"
                    />
                  )}
                  <span>
                    {OUTPUT_KIND_LABEL[output.kind] ?? "Output"} attached
                  </span>
                </>
              ) : blocked ? (
                <span className="inline-flex items-center gap-1.5 text-warning">
                  <WarningTriangle className="size-3.5" />
                  <span>Sample output required</span>
                </span>
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-foreground/20"
                  />
                  <span>No sample output yet</span>
                </>
              )}
            </span>
          </>
        ) : null}
      </button>

      {isEditor && blocked ? (
        // The mockup `.dropzone` affordance. NOT a real dropzone — clicking opens
        // the NodeForm sheet where Story 2.4's uploader lives. `nodrag` so it
        // clicks instead of starting a canvas node-drag (Story 2.3).
        <button
          type="button"
          onClick={onEdit}
          className="nodrag mx-4 mb-4 flex w-[calc(100%-2rem)] items-center gap-2.5 rounded-lg border border-dashed border-warning/40 bg-warning/[0.07] px-3 py-2.5 text-left outline-none transition hover:bg-warning/[0.12] focus-visible:ring-3 focus-visible:ring-warning/40"
        >
          <WarningTriangle className="size-4 shrink-0 text-warning" />
          <span className="flex flex-col">
            <span className="text-[12.5px] font-medium text-warning">
              Add a sample output to publish
            </span>
            <span className="text-[11px] text-muted-foreground">
              Required to publish
            </span>
          </span>
        </button>
      ) : null}

      {detailsOpen ? (
        // `nodrag` so links/text inside don't start a React Flow node drag (Story 2.3).
        <div className="nodrag flex flex-col gap-3 px-4 pb-4">
          <Detail label="Prompt">
            <p className="whitespace-pre-wrap rounded-lg border border-accent-foreground/25 bg-accent/40 p-2.5 font-mono text-[12px] leading-relaxed">
              {node.prompt}
            </p>
          </Detail>
          {/* Viewer only (AC2): the editor surfaces the output in the NodeForm
              sheet, so rendering it here too would duplicate it (and its alt). */}
          {!isEditor && output ? (
            <Detail label="Sample output">
              <OutputPreview output={output} />
            </Detail>
          ) : null}
          <Detail label="Purpose">
            <p className="text-sm text-muted-foreground">{node.purpose}</p>
          </Detail>
          {node.tool_version ? (
            <Detail label="Tool version">
              <span className="font-mono text-sm">{node.tool_version}</span>
            </Detail>
          ) : null}
          {node.est_cost ? (
            <Detail label="Est. cost">
              <span className="font-mono text-sm">{node.est_cost}</span>
            </Detail>
          ) : null}
          {node.notes ? (
            <Detail
              label={node.note_lang ? `Notes (${node.note_lang})` : "Notes"}
            >
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {node.notes}
              </p>
            </Detail>
          ) : null}
          {node.tool_url ? (
            <Detail label="Tool URL">
              {isSafeHttpUrl(node.tool_url) ? (
                <a
                  href={node.tool_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm text-accent-foreground underline underline-offset-2"
                >
                  {node.tool_url}
                </a>
              ) : (
                <span className="break-all text-sm text-muted-foreground">
                  {node.tool_url}
                </span>
              )}
            </Detail>
          ) : null}
        </div>
      ) : null}

      {isEditor && selected ? (
        // `nodrag` so the action buttons click instead of dragging the node (2.3).
        <div className="nodrag flex items-center gap-2 border-t border-border/60 px-4 py-2.5">
          <Button type="button" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      ) : null}
    </div>
  );
}
