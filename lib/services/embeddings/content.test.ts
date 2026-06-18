import { describe, expect, it } from "vitest";
import {
  assembleEmbeddableText,
  contentHash,
  type EmbeddableNode,
  type EmbeddableWorkflow,
} from "./content";

const wf: EmbeddableWorkflow = {
  title: "Coffee-shop brand kit",
  summary: "A full identity in an afternoon",
};

function node(
  over: Partial<EmbeddableNode> & Pick<EmbeddableNode, "idx">,
): EmbeddableNode {
  return {
    step_title: "Step",
    tool_name: "Midjourney",
    tool_version: null,
    prompt: "a minimal logo",
    purpose: "draft the mark",
    notes: null,
    ...over,
  };
}

describe("assembleEmbeddableText", () => {
  it("includes title, summary, and each node's content", () => {
    const text = assembleEmbeddableText(wf, [node({ idx: 0 })]);
    expect(text).toContain("Coffee-shop brand kit");
    expect(text).toContain("A full identity in an afternoon");
    expect(text).toContain("Midjourney");
    expect(text).toContain("a minimal logo");
  });

  it("orders nodes by idx (fetch order irrelevant)", () => {
    const a = assembleEmbeddableText(wf, [
      node({ idx: 0, prompt: "first" }),
      node({ idx: 1, prompt: "second" }),
    ]);
    const b = assembleEmbeddableText(wf, [
      node({ idx: 1, prompt: "second" }),
      node({ idx: 0, prompt: "first" }),
    ]);
    expect(a).toBe(b);
    expect(a.indexOf("first")).toBeLessThan(a.indexOf("second"));
  });

  it("skips null/blank fields without crashing", () => {
    const text = assembleEmbeddableText({ title: "T", summary: null }, [
      node({ idx: 0, step_title: null, tool_version: null, notes: null }),
    ]);
    expect(text).toContain("T");
    expect(text).not.toContain("· ·"); // no empty segments left between separators
  });

  it("handles a workflow with no nodes", () => {
    expect(assembleEmbeddableText(wf, [])).toBe(
      "Coffee-shop brand kit\nA full identity in an afternoon",
    );
  });
});

describe("contentHash skip-reembed", () => {
  it("is deterministic — same input → same hash", () => {
    const text = assembleEmbeddableText(wf, [node({ idx: 0 })]);
    expect(contentHash(text)).toBe(contentHash(text));
  });

  it("changes when embeddable content changes", () => {
    const base = contentHash(
      assembleEmbeddableText(wf, [node({ idx: 0, prompt: "a minimal logo" })]),
    );
    const edited = contentHash(
      assembleEmbeddableText(wf, [node({ idx: 0, prompt: "a bold logo" })]),
    );
    const titled = contentHash(
      assembleEmbeddableText({ ...wf, title: "Different" }, [node({ idx: 0 })]),
    );
    const added = contentHash(
      assembleEmbeddableText(wf, [
        node({ idx: 0 }),
        node({ idx: 1, prompt: "extra" }),
      ]),
    );
    expect(edited).not.toBe(base);
    expect(titled).not.toBe(base);
    expect(added).not.toBe(base);
  });

  it("is stable across re-assembly of the same data (the skip path)", () => {
    const nodes = [node({ idx: 1 }), node({ idx: 0, prompt: "first" })];
    const first = contentHash(assembleEmbeddableText(wf, nodes));
    const again = contentHash(assembleEmbeddableText(wf, [...nodes].reverse()));
    expect(first).toBe(again);
  });
});
