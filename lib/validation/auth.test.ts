import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "./auth";

describe("signInSchema", () => {
  it("accepts a valid email + non-empty password", () => {
    expect(
      signInSchema.safeParse({ email: "user@example.com", password: "x" })
        .success,
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(
      signInSchema.safeParse({ email: "not-an-email", password: "x" }).success,
    ).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(
      signInSchema.safeParse({ email: "user@example.com", password: "" })
        .success,
    ).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("requires a password of at least 8 characters", () => {
    expect(
      signUpSchema.safeParse({ email: "user@example.com", password: "short" })
        .success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({
        email: "user@example.com",
        password: "longenough",
      }).success,
    ).toBe(true);
  });
});
