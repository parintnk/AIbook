import "server-only";
import { cache } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseStorage } from "./storage/supabase-storage";

/**
 * Node-outputs domain/service layer (DR-1) — the ONLY place node_outputs SQL lives
 * (Story 2.4). An output is the one real sample a node produces (FR10): an
 * image/video/file in the private `node-outputs` bucket, or inline text. Outputs
 * have no author_id; ownership derives TWO hops (output → node → workflow → author),
 * so RLS gates reads (published-or-author) and writes (author of the parent DRAFT).
 *
 * These functions add defense-in-depth atop RLS: writes re-assert
 * `ownsDraftForNode` (a typed not_found instead of a raw RLS rejection, and the
 * Route Handler reuses it as the pre-body guard), and `.select().maybeSingle()`
 * surfaces an RLS-filtered row as not_found rather than a false success.
 *
 * unique(node_id) makes an output single-per-node; "replace-on-reupload" is an
 * UPDATE-then-INSERT (NOT supabase `.upsert`, which would put node_id in the
 * ON CONFLICT … SET clause → blocked by the column-lock harden). The race (two
 * concurrent uploads onto one node) is caught by unique(node_id) → 23505.
 */

export type NodeOutput = Tables<"node_outputs">;

export type NodeOutputResult =
  | { ok: true; output: NodeOutput }
  | { ok: false; error: NodeOutputError };

export type NodeOutputDeleteResult =
  | { ok: true; freedPaths: string[] }
  | { ok: false; error: NodeOutputError };

type NodeOutputError =
  | "not_authenticated"
  | "not_found"
  | "invalid_output"
  | "duplicate"
  | "db_error";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * True if `nodeId` belongs to a draft owned by `userId` (the 2.2 edit-drafts rule,
 * one hop deeper). Exported so the upload Route Handler reuses it as the pre-body
 * write-guard.
 */
export async function ownsDraftForNode(
  supabase: SupabaseServerClient,
  userId: string,
  nodeId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("workflow_nodes")
    .select("id, workflows!inner(author_id, status)")
    .eq("id", nodeId)
    .eq("workflows.author_id", userId)
    .eq("workflows.status", "draft")
    .maybeSingle();
  return Boolean(data);
}

/** The current output for a node, or null. RLS scopes visibility to the caller. */
export const getNodeOutput = cache(
  async (nodeId: string): Promise<NodeOutput | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("node_outputs")
      .select("*")
      .eq("node_id", nodeId)
      .maybeSingle();
    return (data as NodeOutput | null) ?? null;
  },
);

/**
 * All outputs for a workflow's nodes, hydrated in one round-trip (the editor
 * surface maps them per node). RLS scopes visibility to the caller.
 */
export const listOutputsForWorkflow = cache(
  async (workflowId: string): Promise<NodeOutput[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("node_outputs")
      .select("*, workflow_nodes!inner(workflow_id)")
      .eq("workflow_nodes.workflow_id", workflowId);
    // Strip the join helper so callers get clean NodeOutput rows.
    return (
      (data as (NodeOutput & { workflow_nodes: unknown })[] | null)?.map(
        ({ workflow_nodes: _join, ...row }) => row,
      ) ?? []
    );
  },
);

/** Map a Postgres error code to a typed output error. */
function mapDbError(code: string | undefined): NodeOutputError {
  if (code === "23505") return "duplicate"; // unique(node_id) — concurrent insert
  if (code === "23514") return "invalid_output"; // kind/payload CHECK
  return "db_error";
}

/**
 * Replace-on-reupload write. UPDATE the existing row (node_id is column-locked, so
 * it's never in the SET); if no row exists yet, INSERT. Both paths re-assert
 * ownership first.
 */
async function writeOutput(
  nodeId: string,
  payload: {
    kind: NodeOutput["kind"];
    storage_path: string | null;
    text_content: string | null;
    mime: string | null;
    bytes: number | null;
  },
): Promise<NodeOutputResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  if (!(await ownsDraftForNode(supabase, user.id, nodeId))) {
    return { ok: false, error: "not_found" };
  }

  // Try UPDATE first (the common replace path). Zero rows → no output yet → INSERT.
  const updated = await supabase
    .from("node_outputs")
    .update(payload)
    .eq("node_id", nodeId)
    .select("*")
    .maybeSingle();
  if (updated.error) {
    return { ok: false, error: mapDbError(updated.error.code) };
  }
  if (updated.data) return { ok: true, output: updated.data as NodeOutput };

  const inserted = await supabase
    .from("node_outputs")
    .insert({ node_id: nodeId, ...payload })
    .select("*")
    .maybeSingle();
  if (inserted.error) {
    return { ok: false, error: mapDbError(inserted.error.code) };
  }
  if (!inserted.data) return { ok: false, error: "not_found" };
  return { ok: true, output: inserted.data as NodeOutput };
}

/** Attach/replace a binary (image|video|file) output for a node. */
export async function upsertBinaryOutput(input: {
  nodeId: string;
  kind: "image" | "video" | "file";
  storagePath: string;
  mime: string;
  bytes: number;
}): Promise<NodeOutputResult> {
  return writeOutput(input.nodeId, {
    kind: input.kind,
    storage_path: input.storagePath,
    text_content: null,
    mime: input.mime,
    bytes: input.bytes,
  });
}

/** Attach/replace an inline text output for a node. */
export async function upsertTextOutput(input: {
  nodeId: string;
  text: string;
}): Promise<NodeOutputResult> {
  return writeOutput(input.nodeId, {
    kind: "text",
    storage_path: null,
    text_content: input.text,
    mime: null,
    bytes: null,
  });
}

/**
 * Delete a node's output. Returns the freed storage_path(s) (empty for a text
 * output) so the caller can also remove the stored object(s). The thumb path is
 * derived by convention (main `.../main.<ext>` → `.../thumb.webp`). RLS enforces
 * parent-draft ownership; zero rows → not_found.
 */
export async function deleteNodeOutput(
  nodeId: string,
): Promise<NodeOutputDeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("node_outputs")
    .delete()
    .eq("node_id", nodeId)
    .select("storage_path")
    .maybeSingle();
  if (error) return { ok: false, error: "db_error" };
  if (!data) return { ok: false, error: "not_found" };

  const freedPaths: string[] = [];
  const path = (data as { storage_path: string | null }).storage_path;
  if (path) {
    freedPaths.push(path);
    freedPaths.push(deriveThumbPath(path));
  }
  return { ok: true, freedPaths };
}

/** main object path → its derived thumbnail path (sharp writes thumb.webp). */
export function deriveThumbPath(mainPath: string): string {
  const slash = mainPath.lastIndexOf("/");
  const dir = slash === -1 ? "" : mainPath.slice(0, slash + 1);
  return `${dir}thumb.webp`;
}

/**
 * A node output enriched with time-limited signed URLs for safe CDN serving (AC2).
 * `thumbUrl` is the image thumbnail; `mainUrl` the full image / video / file. Both
 * null for a text output (use `text_content`). Resolved server-side so signed URLs
 * never round-trip through the client; a page refresh re-issues fresh ones.
 */
export type NodeOutputView = NodeOutput & {
  thumbUrl: string | null;
  mainUrl: string | null;
};

/** All outputs for a workflow, keyed by node_id, with signed URLs resolved. */
export async function listOutputViewsForWorkflow(
  workflowId: string,
): Promise<Record<string, NodeOutputView>> {
  const outputs = await listOutputsForWorkflow(workflowId);
  if (outputs.length === 0) return {};

  const supabase = await createClient();
  const storage = createSupabaseStorage(supabase);
  const entries = await Promise.all(
    outputs.map(async (o) => {
      let mainUrl: string | null = null;
      let thumbUrl: string | null = null;
      if (o.storage_path) {
        try {
          mainUrl = await storage.signedUrl(o.storage_path);
        } catch {
          mainUrl = null;
        }
        if (o.kind === "image") {
          try {
            thumbUrl = await storage.signedUrl(deriveThumbPath(o.storage_path));
          } catch {
            thumbUrl = null;
          }
        }
      }
      return [o.node_id, { ...o, mainUrl, thumbUrl }] as const;
    }),
  );
  return Object.fromEntries(entries);
}
