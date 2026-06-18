import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/embeddings/embed-job", () => ({
  embedPublishedWorkflows: vi.fn(async () => ({
    scanned: 3,
    embedded: 2,
    skipped: 1,
  })),
}));

import { embedPublishedWorkflows } from "@/lib/services/embeddings/embed-job";
import { GET } from "./route";

function req(authHeader?: string) {
  return new Request("http://localhost/api/cron/embed", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

beforeEach(() => vi.mocked(embedPublishedWorkflows).mockClear());
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/embed", () => {
  it("401s without the CRON_SECRET bearer", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(embedPublishedWorkflows).not.toHaveBeenCalled();
  });

  it("401s with a wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await GET(req("Bearer nope"))).status).toBe(401);
  });

  it("401s when no CRON_SECRET is configured (blank → endpoint disabled)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer anything"))).status).toBe(401);
  });

  it("runs the embed job with the correct bearer", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      scanned: 3,
      embedded: 2,
      skipped: 1,
    });
    expect(embedPublishedWorkflows).toHaveBeenCalledTimes(1);
  });
});
