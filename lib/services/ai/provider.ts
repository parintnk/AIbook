import "server-only";

/**
 * The shared AI generation provider (Story 11.1). Mirrors the 10.1 embedder seam: env-gated so the AI
 * SDK never loads without a key, and the provider is REUSED across AI features (11.2 Skeleton, 11.3
 * Doctor). DECISION (No13): generation uses GEMINI directly (`@ai-sdk/google` + the existing
 * GOOGLE_GENERATIVE_AI_API_KEY) — NO Vercel AI Gateway, NO Claude (a documented AR6 deviation; cost
 * governance is the per-user `ai_usage` caps, not gateway alerts). 11.1 only CONSTRUCTS the model
 * factory; the real `generateObject`/`generateText` calls land in 11.2/11.3.
 */

/** The default Gemini chat/generation model — the cheap, fast flash tier (the Haiku-class intent). */
export const DEFAULT_CHAT_MODEL = "gemini-2.5-flash";

/** True when a real Google AI key is configured (callers gate on this before generating). */
export function hasAiKey(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

/**
 * The chat/generation LanguageModel for `generateObject`/`generateText` (the AI SDK). Dynamically
 * imports `@ai-sdk/google` so the SDK never loads without a key. The model id is `AI_CHAT_MODEL`
 * (default `gemini-2.5-flash`), swappable by env like the embedder's `EMBED_MODEL`. Throws without a
 * key — callers (11.2/11.3) MUST gate on `hasAiKey()` first.
 */
export async function chatModel() {
  if (!hasAiKey()) {
    throw new Error("chatModel: GOOGLE_GENERATIVE_AI_API_KEY is not set.");
  }
  const { google } = await import("@ai-sdk/google");
  // `?.trim() ||` (not `??`): a set-but-blank AI_CHAT_MODEL must fall back, not pass google("").
  const modelId = process.env.AI_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL;
  return google(modelId);
}
