import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assembleEmbeddableText,
  contentHash,
  type EmbeddableNode,
} from "./content";
import { embedText } from "./embedder";

/**
 * The embeddings maintenance pass (Story 10.1), run by the Vercel Cron route via the SERVICE-ROLE
 * admin client (bypasses RLS — no user session). Scans published workflows NEWEST-first (so freshly
 * published/updated work is always covered), and for each: assemble the embeddable text, hash it, and
 * SKIP when the stored `workflow_embeddings.content_hash` already matches (the NFR2 cost lever — no
 * embed call, no write); otherwise embed + upsert. Nodes + existing hashes are each fetched in ONE
 * batched `.in()` query (no N+1). A per-workflow failure is isolated (counted, not fatal) so one bad
 * row can't starve the rest of the batch. A backlog beyond the cap is logged, not silently dropped.
 */

export type EmbedJobResult = {
  scanned: number;
  embedded: number;
  skipped: number;
  failed: number;
};

// Per-run scan/embed cap. Generous so the whole foreseeable corpus fits in one run; newest-first means
// new content is never starved if it's ever exceeded. (A cursor / anti-join for full coverage beyond
// the cap is deferred — see deferred-work.) Overridable via the arg.
const DEFAULT_LIMIT = 200;

export async function embedPublishedWorkflows({
  limit = DEFAULT_LIMIT,
}: {
  limit?: number;
} = {}): Promise<EmbedJobResult> {
  const supabase = createAdminClient();

  const { data: workflows, error: wfErr } = await supabase
    .from("workflows")
    .select("id, title, summary")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (wfErr) throw wfErr;
  if (!workflows || workflows.length === 0) {
    return { scanned: 0, embedded: 0, skipped: 0, failed: 0 };
  }
  if (workflows.length === limit) {
    console.warn(
      `[embed-job] scan hit the cap (${limit}); older published workflows are not covered this run.`,
    );
  }

  const ids = workflows.map((w) => w.id);

  const { data: nodeRows, error: nErr } = await supabase
    .from("workflow_nodes")
    .select(
      "workflow_id, idx, step_title, tool_name, tool_version, prompt, purpose, notes",
    )
    .in("workflow_id", ids);
  if (nErr) throw nErr;
  const nodesByWorkflow = new Map<string, EmbeddableNode[]>();
  for (const n of nodeRows ?? []) {
    const list = nodesByWorkflow.get(n.workflow_id) ?? [];
    list.push(n);
    nodesByWorkflow.set(n.workflow_id, list);
  }

  const { data: existing, error: eErr } = await supabase
    .from("workflow_embeddings")
    .select("workflow_id, content_hash")
    .in("workflow_id", ids);
  if (eErr) throw eErr;
  const storedHash = new Map<string, string>();
  for (const row of existing ?? [])
    storedHash.set(row.workflow_id, row.content_hash);

  let embedded = 0;
  let skipped = 0;
  let failed = 0;
  for (const wf of workflows) {
    const text = assembleEmbeddableText(
      { title: wf.title, summary: wf.summary },
      nodesByWorkflow.get(wf.id) ?? [],
    );
    const hash = contentHash(text);
    if (storedHash.get(wf.id) === hash) {
      skipped++;
      continue;
    }
    // Isolate per-workflow failures (a provider timeout / one bad upsert) so the batch continues.
    try {
      const vector = await embedText(text);
      const { error: upErr } = await supabase
        .from("workflow_embeddings")
        .upsert(
          {
            workflow_id: wf.id,
            embedding: `[${vector.join(",")}]`,
            content_hash: hash,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "workflow_id" },
        );
      if (upErr) throw upErr;
      embedded++;
    } catch (error) {
      failed++;
      console.error(`[embed-job] failed to embed workflow ${wf.id}`, error);
    }
  }

  return { scanned: workflows.length, embedded, skipped, failed };
}
