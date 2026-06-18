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

import { generateSkeleton } from "./skeleton";

beforeEach(() => {
  hasKey = false;
  generateObject.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("generateSkeleton — stub ($0, no key)", () => {
  it("returns a deterministic 3-node skeleton when no AI key is set", async () => {
    const a = await generateSkeleton({
      profession: "Designer",
      goal: "a logo",
    });
    const b = await generateSkeleton({
      profession: "Designer",
      goal: "a logo",
    });
    expect(a).toHaveLength(3);
    expect(a).toEqual(b); // deterministic
    expect(generateObject).not.toHaveBeenCalled();
    // valid NodeInput shape: required spine present, optional fields null
    expect(a[0].tool_name).toBeTruthy();
    expect(a[0].prompt).toContain("a logo");
    expect(a[0].purpose).toBeTruthy();
    expect(a[0].est_time).toBeNull();
    expect(a[0].tool_url).toBeNull();
  });
});

describe("generateSkeleton — real (Gemini generateObject)", () => {
  it("maps generated nodes to NodeInput and clamps to 5", async () => {
    hasKey = true;
    generateObject.mockResolvedValue({
      object: {
        nodes: Array.from({ length: 6 }, (_, i) => ({
          step_title: `S${i}`,
          tool_name: `Tool${i}`,
          tool_version: i === 0 ? "4o" : null,
          prompt: `prompt ${i}`,
          purpose: `purpose ${i}`,
        })),
      },
    });
    const out = await generateSkeleton({
      profession: "Marketer",
      goal: "launch email",
    });
    expect(generateObject).toHaveBeenCalledOnce();
    expect(out).toHaveLength(5); // clamped from 6
    expect(out[0]).toMatchObject({
      step_title: "S0",
      tool_name: "Tool0",
      tool_version: "4o",
      prompt: "prompt 0",
      purpose: "purpose 0",
      est_time: null,
      notes: null,
    });
    // a null tool_version maps through as null (not "")
    expect(out[1].tool_version).toBeNull();
  });
});
