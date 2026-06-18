import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let hasKey = false;
const generateObject = vi.fn();

vi.mock("ai", () => ({
  generateObject: (...a: unknown[]) => generateObject(...a),
}));
vi.mock("./provider", () => ({
  hasAiKey: () => hasKey,
  chatModel: async () => ({ __model: "gemini-2.5-flash" }),
}));

import { type DoctorNode, reviewWorkflow } from "./doctor";

/** A rich (non-thin) node by default; override `id`/`idx` + any field to make it thin. */
function node(
  over: Partial<DoctorNode> & { id: string; idx: number },
): DoctorNode {
  return {
    step_title: "A step",
    tool_name: "ChatGPT",
    tool_version: null,
    prompt: "A sufficiently long prompt that clears the thin threshold easily.",
    purpose: "A sufficiently long purpose that clears the thin threshold too.",
    notes: null,
    ...over,
  };
}

beforeEach(() => {
  hasKey = false;
  generateObject.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("reviewWorkflow — stub ($0, no key)", () => {
  it("flags a thin node, passes a rich node, and is deterministic", async () => {
    const thin = node({ id: "a", idx: 0, prompt: "x", purpose: "y" });
    const rich = node({ id: "b", idx: 1 });
    const r = await reviewWorkflow({
      nodes: [thin, rich],
      missingOutputNodeIds: [],
    });
    expect(generateObject).not.toHaveBeenCalled();
    expect(r.nodes[0]).toMatchObject({ nodeId: "a", idx: 0, status: "flag" });
    expect(r.nodes[0].flags[0].check).toBe("thin_context");
    expect(r.nodes[1]).toMatchObject({ nodeId: "b", idx: 1, status: "pass" });
    expect(r.nodes[1].flags).toHaveLength(0);
    expect(r).toMatchObject({ pass: 1, flag: 1 });
    // deterministic: same input → same review
    const again = await reviewWorkflow({
      nodes: [thin, rich],
      missingOutputNodeIds: [],
    });
    expect(again).toEqual(r);
  });

  it("merges the deterministic missing_output req-flag onto an otherwise-passing node", async () => {
    const rich = node({ id: "b", idx: 0 });
    const r = await reviewWorkflow({
      nodes: [rich],
      missingOutputNodeIds: ["b"],
    });
    expect(r.nodes[0].status).toBe("flag");
    expect(r.nodes[0].flags).toHaveLength(1);
    expect(r.nodes[0].flags[0]).toMatchObject({
      check: "missing_output",
      required: true,
    });
    expect(r).toMatchObject({ pass: 0, flag: 1 });
  });
});

describe("reviewWorkflow — real (Gemini generateObject)", () => {
  it("maps idx→node, defaults an omitted node to pass, drops an unknown idx, merges missing_output", async () => {
    hasKey = true;
    generateObject.mockResolvedValue({
      object: {
        nodes: [
          {
            idx: 0,
            status: "flag",
            flags: [{ check: "tool_mismatch", message: "Use a vector tool." }],
          },
          // idx 1 omitted by the model → defaults to pass
          {
            idx: 99, // an idx not in our node set → dropped
            status: "flag",
            flags: [{ check: "thin_context", message: "ignored" }],
          },
        ],
      },
    });

    const out = await reviewWorkflow({
      nodes: [
        node({ id: "a", idx: 0, step_title: "Define" }),
        node({ id: "b", idx: 1 }),
        node({ id: "c", idx: 2 }),
      ],
      missingOutputNodeIds: ["a", "c"], // a has BOTH an AI flag + missing; c has only missing
    });

    expect(generateObject).toHaveBeenCalledOnce();
    expect(out.nodes).toHaveLength(3); // unknown idx 99 produced no extra verdict
    // node a: AI flag FIRST, then the appended missing_output req-flag (mockup order)
    expect(out.nodes[0]).toMatchObject({
      nodeId: "a",
      idx: 0,
      stepTitle: "Define",
      status: "flag",
    });
    expect(out.nodes[0].flags.map((f) => f.check)).toEqual([
      "tool_mismatch",
      "missing_output",
    ]);
    // node b: omitted by the model → pass
    expect(out.nodes[1]).toMatchObject({ nodeId: "b", status: "pass" });
    expect(out.nodes[1].flags).toHaveLength(0);
    // node c: only the deterministic missing_output flag
    expect(out.nodes[2]).toMatchObject({ nodeId: "c", status: "flag" });
    expect(out.nodes[2].flags[0].check).toBe("missing_output");
    expect(out).toMatchObject({ pass: 1, flag: 2 });
  });

  it("dedups repeated checks on a node (schema permits dups; the panel keys on check)", async () => {
    hasKey = true;
    generateObject.mockResolvedValue({
      object: {
        nodes: [
          {
            idx: 0,
            status: "flag",
            flags: [
              { check: "thin_context", message: "first" },
              { check: "thin_context", message: "second (dup check)" },
              { check: "output_quality", message: "distinct" },
            ],
          },
        ],
      },
    });
    const out = await reviewWorkflow({
      nodes: [node({ id: "a", idx: 0 })],
      missingOutputNodeIds: [],
    });
    // the duplicate thin_context collapses to one (first-wins); the distinct check survives
    expect(out.nodes[0].flags.map((f) => f.check)).toEqual([
      "thin_context",
      "output_quality",
    ]);
    expect(out.nodes[0].flags[0].message).toBe("first");
  });
});
