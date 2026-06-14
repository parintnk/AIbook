import { describe, expect, it } from "vitest";
import { workflowDraftSchema } from "./workflow";

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
