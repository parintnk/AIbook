"use client";

import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowEdge } from "@/lib/services/workflow-edges";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { RecipeCard } from "./recipe-card";

/**
 * The read-only linear step-list (Story 3.2 / UX-DR22 / FR6) — the SSR'd primary
 * a11y + mobile path for the public viewer. An ordered list (step 1→N) of the
 * shared RecipeCard in `mode="viewer"`, with source→target edge descriptors so the
 * sequence / branching reads without operating the spatial canvas. Lean + fully
 * read-only: NO editor store / actions / sheet / selection (cf. `workflow-steps.tsx`,
 * the mutation-coupled editor list whose shape this mirrors). Renders on the server
 * (the surface defaults to this view) so crawlers, no-JS, and screen-reader users
 * get the full recipe as the primary content.
 */
export function WorkflowStepList({
  nodes,
  edges,
  outputsByNodeId,
}: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  outputsByNodeId: Record<string, NodeOutputView>;
}) {
  if (nodes.length === 0) return null;

  // Order by the stored idx (defensive — the caller sorts, but the list must not
  // depend on it). The step NUMBER is `idx + 1` to match the RecipeCard header AND
  // the canvas viewer: deriving it from idx (not array position) keeps the list, the
  // cards, and the connectors mutually consistent even if a published workflow's idx
  // has a gap (a draft can delete a middle node then add one; the 2.5 publish gate
  // does not enforce contiguity). Map node id → its displayed step number.
  const ordered = [...nodes].sort((a, b) => a.idx - b.idx);
  const stepByNodeId = new Map(ordered.map((n) => [n.id, n.idx + 1]));

  return (
    <ol className="mt-6 flex flex-col gap-3">
      {ordered.map((n) => {
        // Outgoing edges only — each edge has exactly one source, so describing every
        // node's outgoing targets announces each connection once (AC1). Targets are
        // the target nodes' displayed step numbers; an edge to a node not in the list
        // (orphaned/unpublished target) is dropped rather than shown as "undefined".
        const targets = [
          ...new Set(
            edges
              .filter((e) => e.source_node_id === n.id)
              .map((e) => stepByNodeId.get(e.target_node_id))
              .filter((s): s is number => s !== undefined),
          ),
        ].sort((a, b) => a - b);

        return (
          <li key={n.id} className="flex flex-col gap-2">
            {/* Positional framing for assistive tech (UX-DR22). This + the visible
                card together announce step number + tool + state; the card supplies
                the tool / title / output state, so this stays minimal to avoid
                double-reading. The number is `idx + 1` to match the card. */}
            <span className="sr-only">
              Step {n.idx + 1} of {ordered.length}
            </span>
            <RecipeCard
              node={n}
              output={outputsByNodeId[n.id] ?? null}
              mode="viewer"
            />
            {targets.length > 0 ? <StepConnector targets={targets} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Source→target connector (AC1) — real, SR-readable text, not `aria-hidden`. */
function StepConnector({ targets }: { targets: number[] }) {
  const label =
    targets.length === 1
      ? `Leads to step ${targets[0]}`
      : `Leads to steps ${targets.join(", ")}`;
  return (
    <p className="flex items-center gap-1.5 self-center text-[11px] text-muted-foreground">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="var(--accent-foreground)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
      </svg>
      <span>{label}</span>
    </p>
  );
}
