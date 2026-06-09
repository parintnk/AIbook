import { describe, expect, it } from "vitest";
import { getHealth } from "./health.service";

describe("getHealth", () => {
  it("reports the service is ok", () => {
    expect(getHealth()).toEqual({ ok: true, service: "idea" });
  });
});
