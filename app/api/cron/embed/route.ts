import { embedPublishedWorkflows } from "@/lib/services/embeddings/embed-job";

/**
 * Embeddings maintenance Cron (Story 10.1). Invoked by Vercel Cron (see vercel.json) every few hours;
 * embeds published/changed workflows + skips unchanged (content_hash). Node runtime — the AI SDK +
 * service-role client are Node-only, never Edge. Gated by a `CRON_SECRET` Bearer (Vercel Cron sends it);
 * a missing/wrong secret → 401, so the endpoint can't be triggered publicly.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await embedPublishedWorkflows();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/embed] failed", error);
    return Response.json({ ok: false, error: "embed_failed" }, { status: 500 });
  }
}
