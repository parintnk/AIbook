import { describe, expect, it } from "vitest";
import { workflowDraftSchema, workflowNodeSchema } from "./workflow";

describe("workflowDraftSchema", () => {
  const valid = {
    title: "My workflow",
    summary: "A short summary",
    profession_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  };

  it("accepts a valid draft", () => {
    expect(workflowDraftSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a blank title (after trim)", () => {
    expect(
      workflowDraftSchema.safeParse({ ...valid, title: "   " }).success,
    ).toBe(false);
  });

  it("rejects a title over 120 characters", () => {
    expect(
      workflowDraftSchema.safeParse({ ...valid, title: "a".repeat(121) })
        .success,
    ).toBe(false);
  });

  it("rejects a summary over 280 characters", () => {
    expect(
      workflowDraftSchema.safeParse({ ...valid, summary: "a".repeat(281) })
        .success,
    ).toBe(false);
  });

  it("allows an empty summary", () => {
    expect(
      workflowDraftSchema.safeParse({ ...valid, summary: "" }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid profession_id", () => {
    expect(
      workflowDraftSchema.safeParse({ ...valid, profession_id: "nope" })
        .success,
    ).toBe(false);
  });
});

describe("workflowNodeSchema", () => {
  const valid = {
    step_title: "Define brand direction",
    tool_name: "ChatGPT",
    tool_version: "",
    prompt: "Warm, artisanal, minimalist…",
    purpose: "Set the visual direction before generating logos",
    est_time: "~5 min",
    est_cost: "$0.02",
    notes: "",
    note_lang: "",
    tool_url: "",
  };

  it("accepts a valid node", () => {
    expect(workflowNodeSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a node with only the required fields (optionals blank)", () => {
    expect(
      workflowNodeSchema.safeParse({
        step_title: "",
        tool_name: "Midjourney",
        tool_version: "",
        prompt: "a logo prompt",
        purpose: "generate concepts",
        est_time: "",
        est_cost: "",
        notes: "",
        note_lang: "",
        tool_url: "",
      }).success,
    ).toBe(true);
  });

  it("rejects blank required fields (after trim)", () => {
    for (const field of ["tool_name", "prompt", "purpose"] as const) {
      expect(
        workflowNodeSchema.safeParse({ ...valid, [field]: "   " }).success,
      ).toBe(false);
    }
  });

  it("rejects a prompt over 4000 characters", () => {
    expect(
      workflowNodeSchema.safeParse({ ...valid, prompt: "a".repeat(4001) })
        .success,
    ).toBe(false);
  });

  it("accepts a valid tool URL but rejects non-http(s) schemes (stored-XSS guard)", () => {
    expect(
      workflowNodeSchema.safeParse({
        ...valid,
        tool_url: "https://chatgpt.com",
      }).success,
    ).toBe(true);
    expect(
      workflowNodeSchema.safeParse({
        ...valid,
        tool_url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("persists a native-language note + tag (FR24)", () => {
    const parsed = workflowNodeSchema.safeParse({
      ...valid,
      notes: "ใช้โทนอบอุ่น มินิมอล",
      note_lang: "th",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.note_lang).toBe("th");
  });
});
