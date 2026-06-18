import { describe, expect, it } from "vitest";
import {
  AI_FEATURE_CAPS,
  DOCTOR_CHECK_LABELS,
  type DoctorNodeVerdict,
  featureLabel,
  flagLabel,
  rateLimitCopy,
  summarizeVerdicts,
} from "./ai";

describe("AI caps + copy (Story 11.1)", () => {
  it("exposes the v1 free-tier caps (skeleton 5, doctor 10; export/embed uncapped)", () => {
    expect(AI_FEATURE_CAPS.skeleton).toBe(5);
    expect(AI_FEATURE_CAPS.doctor).toBe(10);
    expect(AI_FEATURE_CAPS.export).toBe(0);
    expect(AI_FEATURE_CAPS.embed).toBe(0);
  });

  it("builds the UX-DR21 rate-limited copy verbatim", () => {
    expect(rateLimitCopy({ feature: "skeleton", limit: 5 })).toBe(
      "You've used today's 5 skeleton runs. Resets at midnight.",
    );
    expect(rateLimitCopy({ feature: "doctor", limit: 10 })).toBe(
      "You've used today's 10 Doctor runs. Resets at midnight.",
    );
  });

  it("labels each feature", () => {
    expect(featureLabel("skeleton")).toBe("skeleton");
    expect(featureLabel("doctor")).toBe("Doctor");
    expect(featureLabel("export")).toBe("export");
    expect(featureLabel("embed")).toBe("embedding");
  });
});

describe("Workflow Doctor types + helpers (Story 11.3)", () => {
  it("labels all 4 AI checks", () => {
    expect(DOCTOR_CHECK_LABELS.thin_context).toBe("Step context is thin");
    expect(DOCTOR_CHECK_LABELS.tool_mismatch).toBe("Tool doesn't fit the step");
    expect(DOCTOR_CHECK_LABELS.single_point_of_failure).toBe(
      "No fallback if this step fails",
    );
    expect(DOCTOR_CHECK_LABELS.output_quality).toBe("Output quality concern");
  });

  it("flagLabel covers the 4 checks + the deterministic missing_output", () => {
    expect(flagLabel("thin_context")).toBe("Step context is thin");
    expect(flagLabel("output_quality")).toBe("Output quality concern");
    // the FR10 req-flag is NOT an AI check but still has a bold lead
    expect(flagLabel("missing_output")).toBe("Missing required output");
  });

  it("summarizeVerdicts counts pass vs flag", () => {
    const nodes: Pick<DoctorNodeVerdict, "status">[] = [
      { status: "pass" },
      { status: "flag" },
      { status: "pass" },
      { status: "flag" },
      { status: "flag" },
    ];
    expect(summarizeVerdicts(nodes)).toEqual({ pass: 2, flag: 3 });
    expect(summarizeVerdicts([])).toEqual({ pass: 0, flag: 0 });
  });
});
