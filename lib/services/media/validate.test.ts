import { beforeEach, describe, expect, it, vi } from "vitest";

// file-type is ESM-only — mock it so vitest never has to interop the real package.
const fileTypeFromBufferMock = vi.fn();
vi.mock("file-type", () => ({
  fileTypeFromBuffer: (...args: unknown[]) => fileTypeFromBufferMock(...args),
}));

// scanFile seam — default clean; overridden per-test.
const scanFileMock = vi.fn();
vi.mock("@/lib/services/storage/scan", () => ({
  scanFile: (...args: unknown[]) => scanFileMock(...args),
}));

// sharp — a chainable stub whose terminal toBuffer() resolves a tiny Buffer, and
// metadata() resolves a single-page (non-animated) image by default.
const toBufferMock = vi.fn();
const metadataMock = vi.fn();
vi.mock("sharp", () => {
  const chain = () => {
    const c: Record<string, unknown> = {};
    for (const m of ["rotate", "resize", "webp", "gif"]) {
      c[m] = vi.fn(() => c);
    }
    c.toBuffer = (...args: unknown[]) => toBufferMock(...args);
    c.metadata = (...args: unknown[]) => metadataMock(...args);
    return c;
  };
  return { default: vi.fn(() => chain()) };
});

import { MEDIA_LIMITS, validateMediaUpload } from "./validate";

const PNG = new Uint8Array([1, 2, 3, 4]); // contents don't matter — sniff is mocked

beforeEach(() => {
  vi.clearAllMocks();
  scanFileMock.mockResolvedValue({ clean: true });
  metadataMock.mockResolvedValue({ pages: 1 });
  toBufferMock.mockResolvedValue(Buffer.from([9, 9, 9]));
});

describe("validateMediaUpload", () => {
  it("rejects oversize before any sniff (too_large)", async () => {
    const big = new Uint8Array(MEDIA_LIMITS.image + 1);
    const res = await validateMediaUpload({
      bytes: big,
      declaredMime: "image/png",
      kind: "image",
    });
    expect(res).toEqual({ ok: false, error: "too_large" });
    expect(fileTypeFromBufferMock).not.toHaveBeenCalled();
  });

  it("rejects unreadable bytes (sniff undefined → unreadable_type)", async () => {
    fileTypeFromBufferMock.mockResolvedValue(undefined);
    const res = await validateMediaUpload({
      bytes: PNG,
      declaredMime: "image/png",
      kind: "image",
    });
    expect(res).toEqual({ ok: false, error: "unreadable_type" });
  });

  it("rejects a wrong-type file even if the extension/declared mime lies (unsupported_type)", async () => {
    // sniff says it's really a PNG, but the caller asked for a video.
    fileTypeFromBufferMock.mockResolvedValue({ ext: "png", mime: "image/png" });
    const res = await validateMediaUpload({
      bytes: PNG,
      declaredMime: "video/mp4",
      kind: "video",
    });
    expect(res).toEqual({
      ok: false,
      error: "unsupported_type",
      detectedType: "image/png",
    });
  });

  it("rejects a sniffed type outside the allowlist (unsupported_type)", async () => {
    fileTypeFromBufferMock.mockResolvedValue({
      ext: "svg",
      mime: "image/svg+xml",
    });
    const res = await validateMediaUpload({
      bytes: PNG,
      declaredMime: "image/svg+xml",
      kind: "image",
    });
    expect(res).toEqual({
      ok: false,
      error: "unsupported_type",
      detectedType: "image/svg+xml",
    });
  });

  it("rejects when the scan fails (infected)", async () => {
    fileTypeFromBufferMock.mockResolvedValue({ ext: "png", mime: "image/png" });
    scanFileMock.mockResolvedValue({ clean: false, reason: "eicar" });
    const res = await validateMediaUpload({
      bytes: PNG,
      declaredMime: "image/png",
      kind: "image",
    });
    expect(res).toEqual({ ok: false, error: "infected" });
  });

  it("re-encodes a valid image to webp + produces a thumbnail", async () => {
    fileTypeFromBufferMock.mockResolvedValue({ ext: "png", mime: "image/png" });
    toBufferMock
      .mockResolvedValueOnce(Buffer.from([1, 1, 1, 1])) // main
      .mockResolvedValueOnce(Buffer.from([2, 2])); // thumb
    const res = await validateMediaUpload({
      bytes: PNG,
      declaredMime: "image/png",
      kind: "image",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.mime).toBe("image/webp");
      expect(res.bytes).toBe(4);
      expect(res.thumb).toBeInstanceOf(Uint8Array);
      expect(res.thumbMime).toBe("image/webp");
    }
  });

  it("keeps an animated GIF as a gif (no thumbnail-less webp flatten)", async () => {
    fileTypeFromBufferMock.mockResolvedValue({ ext: "gif", mime: "image/gif" });
    metadataMock.mockResolvedValue({ pages: 12 });
    const res = await validateMediaUpload({
      bytes: PNG,
      declaredMime: "image/gif",
      kind: "image",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.mime).toBe("image/gif");
  });

  it("returns process_failed if sharp throws (corrupt/bomb)", async () => {
    fileTypeFromBufferMock.mockResolvedValue({ ext: "png", mime: "image/png" });
    metadataMock.mockRejectedValue(new Error("bad image"));
    const res = await validateMediaUpload({
      bytes: PNG,
      declaredMime: "image/png",
      kind: "image",
    });
    expect(res).toEqual({ ok: false, error: "process_failed" });
  });

  it("stores video bytes as-is after sniff+allowlist+scan (no re-encode)", async () => {
    fileTypeFromBufferMock.mockResolvedValue({ ext: "mp4", mime: "video/mp4" });
    const res = await validateMediaUpload({
      bytes: PNG,
      declaredMime: "video/mp4",
      kind: "video",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.mime).toBe("video/mp4");
      expect(res.main).toBe(PNG); // same bytes, untouched
    }
    expect(toBufferMock).not.toHaveBeenCalled();
  });
});
