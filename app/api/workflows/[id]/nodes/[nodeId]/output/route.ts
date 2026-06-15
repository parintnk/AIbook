import { revalidatePath } from "next/cache";
import {
  MEDIA_LIMITS,
  validateMediaUpload,
} from "@/lib/services/media/validate";
import { upsertBinaryOutput } from "@/lib/services/node-outputs";
import { createSupabaseStorage } from "@/lib/services/storage/supabase-storage";
import { createClient } from "@/lib/supabase/server";
import { mediaKindSchema } from "@/lib/validation/output";

/**
 * Binary sample-output upload (Story 2.4, AC1–3). A Route Handler — NOT a Server
 * Action — because Server Actions cap the request body at 1MB (a 10MB image / 100MB
 * video can't pass); Route Handlers stream `request.formData()` with no body limit
 * (Next 16 docs: "for large file uploads, consider Route Handlers"). Validation runs
 * server-side on the buffered bytes (magic-byte sniff + sharp re-encode + scan) — a
 * client-direct-to-Storage upload could not be validated. Text/delete are small →
 * they stay Server Actions.
 */

// sharp needs Node (not Edge); 60s headroom for the re-encode of a 10MB image.
export const runtime = "nodejs";
export const maxDuration = 60;

/** Fixed object keys per node → upsert overwrites in place (never orphans on replace). */
const mainKey = (workflowId: string, nodeId: string) =>
  `${workflowId}/${nodeId}/main`;
const thumbKey = (workflowId: string, nodeId: string) =>
  `${workflowId}/${nodeId}/thumb.webp`;

const limitLabel = (kind: "image" | "video" | "file") =>
  `${Math.round(MEDIA_LIMITS[kind] / (1024 * 1024))}MB`;

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string; nodeId: string }> },
) {
  const { id: workflowId, nodeId } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  // Verify the node exists, belongs to THIS workflow, and the workflow is a draft
  // the caller owns — before we read the body (early 403 + a consistent storage path
  // that always matches the row's node). RLS re-enforces this on the DB write.
  const { data: node } = await supabase
    .from("workflow_nodes")
    .select("id, workflows!inner(author_id, status)")
    .eq("id", nodeId)
    .eq("workflow_id", workflowId)
    .eq("workflows.author_id", user.id)
    .eq("workflows.status", "draft")
    .maybeSingle();
  if (!node) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // Parse the multipart body (no bodySizeLimit on Route Handlers).
  let file: File | null = null;
  let rawKind: unknown;
  try {
    const form = await request.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
    rawKind = form.get("kind");
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const kindParsed = mediaKindSchema.safeParse(rawKind);
  if (!file || !kindParsed.success) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const kind = kindParsed.data;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await validateMediaUpload({
    bytes,
    declaredMime: file.type,
    kind,
  });
  if (!result.ok) {
    // Prefer the SNIFFED type for the "{filetype} isn't supported" copy (what the
    // bytes really are); fall back to the client filename extension otherwise.
    const filetype =
      "detectedType" in result && result.detectedType
        ? result.detectedType.split("/").pop()?.toUpperCase()
        : file.name.includes(".")
          ? file.name.split(".").pop()?.toUpperCase()
          : undefined;
    return Response.json(
      { error: result.error, limit: limitLabel(kind), filetype },
      { status: 422 },
    );
  }

  // Upload main (+ thumb for images) under fixed keys, then write the row.
  const storage = createSupabaseStorage(supabase);
  const mainPath = mainKey(workflowId, nodeId);
  const uploaded: string[] = [];
  try {
    await storage.upload({
      key: mainPath,
      body: result.main,
      mime: result.mime,
    });
    uploaded.push(mainPath);
    if (result.thumb) {
      const tPath = thumbKey(workflowId, nodeId);
      await storage.upload({
        key: tPath,
        body: result.thumb,
        mime: result.thumbMime ?? "image/webp",
      });
      uploaded.push(tPath);
    }
  } catch {
    // Best-effort cleanup of whatever made it up.
    if (uploaded.length) await storage.remove(uploaded).catch(() => {});
    return Response.json({ error: "db_error" }, { status: 500 });
  }

  const saved = await upsertBinaryOutput({
    nodeId,
    kind,
    storagePath: mainPath,
    mime: result.mime,
    bytes: result.bytes,
  });
  if (!saved.ok) {
    // Storage succeeded but the row didn't — remove the orphaned object(s).
    await storage.remove(uploaded).catch(() => {});
    const status = saved.error === "not_found" ? 404 : 500;
    return Response.json({ error: saved.error }, { status });
  }

  // Replacing an image (which had a thumb.webp) with a video/file produces no new
  // thumb → the stale thumbnail would be orphaned. Best-effort remove it.
  if (!result.thumb) {
    await storage.remove([thumbKey(workflowId, nodeId)]).catch(() => {});
  }

  revalidatePath(`/workflows/${workflowId}/edit`);
  return Response.json({ ok: true, output: saved.output });
}
