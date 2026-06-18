import { createHash } from "node:crypto";

/**
 * The embeddable-text + content-hash helpers (Story 10.1). PURE + deterministic — they decide WHAT
 * text represents a workflow for embedding and WHETHER it changed since the last embed (`content_hash`
 * skip = the NFR2 cost lever). No DB, no network → the local-CI correctness net.
 */

export type EmbeddableWorkflow = { title: string; summary: string | null };

export type EmbeddableNode = {
  idx: number;
  step_title: string | null;
  tool_name: string;
  tool_version: string | null;
  prompt: string;
  purpose: string;
  notes: string | null;
};

function clean(parts: (string | null | undefined)[]): string[] {
  return parts.map((s) => s?.trim() ?? "").filter((s) => s.length > 0);
}

/**
 * Assemble the stable text fed to the embedder: workflow title + summary, then each node (ordered by
 * `idx`) — step_title · tool_name · tool_version · prompt · purpose · notes. Null/blank fields are
 * skipped; nodes are sorted by `idx` so the output (and thus the hash) is independent of fetch order.
 * A real content edit (any of these fields, or adding/removing a step) changes the text; a non-embeddable
 * change (e.g. est_cost, a counter, published_at) does not.
 */
export function assembleEmbeddableText(
  workflow: EmbeddableWorkflow,
  nodes: EmbeddableNode[],
): string {
  const head = clean([workflow.title, workflow.summary]);
  const steps = [...nodes]
    .sort((a, b) => a.idx - b.idx)
    .map((n) =>
      clean([
        n.step_title,
        n.tool_name,
        n.tool_version,
        n.prompt,
        n.purpose,
        n.notes,
      ]).join(" · "),
    )
    .filter((line) => line.length > 0);
  return [...head, ...steps].join("\n");
}

/** SHA-256 hex of the embeddable text — stored on the row; equal hash ⇒ skip re-embed. */
export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
