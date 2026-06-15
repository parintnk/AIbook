import type { NodeOutputView } from "@/lib/services/node-outputs";

/**
 * Renders a node's sample output (Story 2.4 kinds: image / video / text / file) from
 * its signed URLs. Shared by the editor's OutputUploader (Story 2.4) and the public
 * RecipeCard viewer expand (Story 3.1 / AC2) so the creator's real proof is shown
 * consistently. Signed URLs come from the private bucket via the supabase CDN — never
 * inlined into HTML.
 */
export function OutputPreview({ output }: { output: NodeOutputView }) {
  if (output.kind === "image") {
    const src = output.mainUrl ?? output.thumbUrl;
    return src ? (
      // biome-ignore lint/performance/noImgElement: signed CDN URL, not a static asset
      <img
        src={src}
        alt="Sample output"
        className="max-h-48 w-full rounded-lg border border-border/60 object-contain"
      />
    ) : (
      <PreviewFallback label="Image output" />
    );
  }
  if (output.kind === "video") {
    return output.mainUrl ? (
      // biome-ignore lint/a11y/useMediaCaption: a user-uploaded sample output has no caption track
      <video
        src={output.mainUrl}
        controls
        preload="metadata"
        className="max-h-48 w-full rounded-lg border border-border/60"
      />
    ) : (
      <PreviewFallback label="Video output" />
    );
  }
  if (output.kind === "text") {
    return (
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-foreground/[0.02] p-2.5 font-mono text-[12px] leading-relaxed">
        {output.text_content}
      </pre>
    );
  }
  // file (pdf)
  return output.mainUrl ? (
    <a
      href={output.mainUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 self-start rounded-lg border border-border/60 bg-foreground/[0.02] px-3 py-2 text-accent-foreground text-sm underline underline-offset-2"
    >
      📄 Open PDF
    </a>
  ) : (
    <PreviewFallback label="File output" />
  );
}

function PreviewFallback({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-border/60 bg-foreground/[0.02] px-3 py-2.5 text-muted-foreground text-sm">
      {label} (preview unavailable)
    </p>
  );
}
