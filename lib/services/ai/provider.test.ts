import { afterEach, describe, expect, it, vi } from "vitest";

const google = vi.fn((id: string) => ({ __model: id }));
vi.mock("@ai-sdk/google", () => ({ google: (id: string) => google(id) }));

import { chatModel, DEFAULT_CHAT_MODEL, hasAiKey } from "./provider";

const KEY = "GOOGLE_GENERATIVE_AI_API_KEY";
const MODEL = "AI_CHAT_MODEL";

afterEach(() => {
  vi.unstubAllEnvs();
  google.mockClear();
});

describe("AI provider (Story 11.1)", () => {
  it("hasAiKey reflects the Google key env", () => {
    vi.stubEnv(KEY, "");
    expect(hasAiKey()).toBe(false);
    vi.stubEnv(KEY, "real-key");
    expect(hasAiKey()).toBe(true);
  });

  it("chatModel throws without a key (callers must gate on hasAiKey)", async () => {
    vi.stubEnv(KEY, "");
    await expect(chatModel()).rejects.toThrow(/GOOGLE_GENERATIVE_AI_API_KEY/);
    expect(google).not.toHaveBeenCalled();
  });

  it("chatModel uses AI_CHAT_MODEL when set", async () => {
    vi.stubEnv(KEY, "real-key");
    vi.stubEnv(MODEL, "gemini-custom-x");
    await chatModel();
    expect(google).toHaveBeenCalledWith("gemini-custom-x");
  });

  it("defaults to gemini-2.5-flash when AI_CHAT_MODEL is unset", async () => {
    vi.stubEnv(KEY, "real-key");
    vi.stubEnv(MODEL, undefined as unknown as string);
    await chatModel();
    expect(google).toHaveBeenCalledWith("gemini-2.5-flash");
    expect(DEFAULT_CHAT_MODEL).toBe("gemini-2.5-flash");
  });

  it("falls back to the default when AI_CHAT_MODEL is set but blank", async () => {
    vi.stubEnv(KEY, "real-key");
    vi.stubEnv(MODEL, "   ");
    await chatModel();
    expect(google).toHaveBeenCalledWith("gemini-2.5-flash");
  });
});
