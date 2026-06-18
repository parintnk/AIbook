import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMBEDDING_DIMS, embedText, stubEmbedding } from "./embedder";

describe("stubEmbedding", () => {
  it("returns a 1536-d vector", () => {
    expect(stubEmbedding("hello")).toHaveLength(EMBEDDING_DIMS);
  });

  it("is deterministic — same text → identical vector", () => {
    expect(stubEmbedding("a goal-based workflow")).toEqual(
      stubEmbedding("a goal-based workflow"),
    );
  });

  it("differs for different text", () => {
    expect(stubEmbedding("alpha")).not.toEqual(stubEmbedding("beta"));
  });

  it("is L2-normalized and finite (cosine-friendly)", () => {
    const v = stubEmbedding("normalize me");
    const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
    expect(v.every((x) => Number.isFinite(x))).toBe(true);
  });
});

describe("embedText", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the deterministic stub when no AI key is set ($0/CI)", async () => {
    const out = await embedText("no key here");
    expect(out).toEqual(stubEmbedding("no key here"));
    expect(out).toHaveLength(EMBEDDING_DIMS);
  });
});
