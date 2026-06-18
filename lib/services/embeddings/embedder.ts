import { contentHash } from "./content";

/**
 * The embedder seam (Story 10.1). `embedText` returns a unit-length 1536-d vector for a piece of text:
 *  - REAL (when `GOOGLE_GENERATIVE_AI_API_KEY` is set): Google Generative AI directly via the AI SDK
 *    (`@ai-sdk/google`). The model is `EMBED_MODEL` (default `gemini-embedding-001`, native 3072 dims),
 *    pinned to 1536 via `outputDimensionality` so it fits the `vector(1536)` column. Gemini does NOT
 *    re-normalize a reduced-dim vector, so we L2-normalize it ourselves (matches the stub + keeps the
 *    vectors unit-length, so they're correct under inner-product as well as the current cosine index).
 *  - STUB (no key): a deterministic, normalized pseudo-vector seeded from the text hash — zero external
 *    calls, so local/CI/`db reset` run at $0 and the pipeline + `content_hash` skip are fully exercised.
 *    Same text → identical vector (so the hash-skip + any nearest-neighbour logic are deterministic).
 * The real path is dynamically imported so `ai`/`@ai-sdk/google` never load unless a key is present.
 */

export const EMBEDDING_DIMS = 1536;

function hasAiKey(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

/** L2-normalize to unit length (divide-by-zero guarded). */
function l2normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((a, v) => a + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

/** Deterministic, L2-normalized 1536-d pseudo-vector from the text (mulberry32 seeded by the sha256). */
export function stubEmbedding(text: string): number[] {
  let s = Number.parseInt(contentHash(text).slice(0, 8), 16) >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return l2normalize(
    Array.from({ length: EMBEDDING_DIMS }, () => rand() * 2 - 1),
  );
}

export async function embedText(text: string): Promise<number[]> {
  if (!hasAiKey()) return stubEmbedding(text);
  // Real path — Google Generative AI directly (the raw Gemini key via GOOGLE_GENERATIVE_AI_API_KEY).
  // Dynamically imported so `ai`/`@ai-sdk/google` never load without a key.
  const { embed } = await import("ai");
  const { google } = await import("@ai-sdk/google");
  const { embedding } = await embed({
    model: google.textEmbeddingModel(
      process.env.EMBED_MODEL ?? "gemini-embedding-001",
    ),
    value: text,
    providerOptions: { google: { outputDimensionality: EMBEDDING_DIMS } },
  });
  // Guard the column contract: a provider that ignores outputDimensionality (or a non-finite element)
  // would otherwise corrupt the vector(1536) upsert / silently break search ranking.
  if (
    embedding.length !== EMBEDDING_DIMS ||
    !embedding.every(Number.isFinite)
  ) {
    throw new Error(
      `embedText: expected ${EMBEDDING_DIMS} finite dims, got ${embedding.length}`,
    );
  }
  return l2normalize(embedding);
}
