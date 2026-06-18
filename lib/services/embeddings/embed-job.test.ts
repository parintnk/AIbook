import { beforeEach, describe, expect, it, vi } from "vitest";
import { assembleEmbeddableText, contentHash } from "./content";

// ── Fixtures: wfA is already-embedded with the CURRENT hash (→ skip); wfB has no embedding (→ embed).
const wfA = {
  id: "wfA",
  title: "Brand kit",
  summary: "identity in an afternoon",
};
const wfB = { id: "wfB", title: "Cold email", summary: null as string | null };
const nodeRows = [
  {
    workflow_id: "wfA",
    idx: 0,
    step_title: "Logo",
    tool_name: "Midjourney",
    tool_version: null,
    prompt: "a mark",
    purpose: "draft",
    notes: null,
  },
  {
    workflow_id: "wfB",
    idx: 0,
    step_title: null,
    tool_name: "GPT-4",
    tool_version: null,
    prompt: "write copy",
    purpose: "outreach",
    notes: null,
  },
];
const wfANodes = nodeRows.filter((n) => n.workflow_id === "wfA");
const wfAHash = contentHash(
  assembleEmbeddableText({ title: wfA.title, summary: wfA.summary }, wfANodes),
);

const upserts: Array<Record<string, unknown>> = [];

vi.mock("./embedder", () => ({
  embedText: vi.fn(async () => Array.from({ length: 1536 }, () => 0.1)),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const builder = (table: string) => {
      const b = {
        select: () => b,
        eq: () => b,
        order: () => b,
        limit: () => Promise.resolve({ data: [wfA, wfB], error: null }),
        in: () =>
          Promise.resolve({
            data:
              table === "workflow_nodes"
                ? nodeRows
                : [{ workflow_id: "wfA", content_hash: wfAHash }], // existing embeddings
            error: null,
          }),
        upsert: (row: Record<string, unknown>) => {
          upserts.push(row);
          return Promise.resolve({ error: null });
        },
      };
      return b;
    };
    return { from: (table: string) => builder(table) };
  },
}));

import { embedPublishedWorkflows } from "./embed-job";
import { embedText } from "./embedder";

beforeEach(() => {
  upserts.length = 0;
  vi.mocked(embedText).mockClear();
});

describe("embedPublishedWorkflows", () => {
  it("skips the unchanged workflow (hash match) and embeds the new one", async () => {
    const result = await embedPublishedWorkflows();
    expect(result).toEqual({ scanned: 2, embedded: 1, skipped: 1, failed: 0 });
    // wfA skipped → embedText called once (wfB only)
    expect(embedText).toHaveBeenCalledTimes(1);
    expect(upserts).toHaveLength(1);
  });

  it("upserts the embedded row with a pgvector string + the fresh content_hash", async () => {
    await embedPublishedWorkflows();
    const row = upserts[0];
    expect(row.workflow_id).toBe("wfB");
    expect(typeof row.embedding).toBe("string");
    expect(row.embedding as string).toMatch(/^\[0\.1(,0\.1)*\]$/); // pgvector literal "[...]"
    expect(row.content_hash).toBe(
      contentHash(
        assembleEmbeddableText({ title: wfB.title, summary: wfB.summary }, [
          nodeRows[1],
        ]),
      ),
    );
  });

  it("isolates a per-workflow embed failure (counts it, batch survives)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(embedText).mockRejectedValueOnce(new Error("provider timeout"));
    const result = await embedPublishedWorkflows();
    expect(result).toEqual({ scanned: 2, embedded: 0, skipped: 1, failed: 1 });
    expect(upserts).toHaveLength(0); // the failed embed never upserts
    errSpy.mockRestore();
  });
});
