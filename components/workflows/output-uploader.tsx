"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteOutputAction,
  setTextOutputAction,
} from "@/app/(app)/workflows/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import { cn } from "@/lib/utils";
import {
  type MediaKindValue,
  type OutputError,
  outputErrorMessage,
} from "@/lib/validation/output";
import { OutputPreview } from "./output-preview";

/**
 * The single sample-output control (Story 2.4) used by both editor surfaces. Binary
 * uploads go to the Route Handler via XHR (so we get real upload progress for the
 * "Checking your file…" state, AC3 — `fetch` can't report upload progress); text +
 * delete go through Server Actions. On success it `router.refresh()` so the RSC
 * re-resolves fresh signed URLs. Empty/uploading/present states match the editor
 * mockup dropzone.
 */

const ACCEPT = "image/*,video/*,application/pdf";

/** Infer the binary kind from the picked file's MIME (server re-validates by sniff). */
function inferKind(file: File): MediaKindValue {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

export function OutputUploader({
  workflowId,
  nodeId,
  output,
  disabled = false,
}: {
  workflowId: string;
  /** Persisted node id. Absent on the create path (upload needs a saved node). */
  nodeId?: string;
  output: NodeOutputView | null;
  /** Create mode: no node yet → render the disabled "save first" hint. */
  disabled?: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showText, setShowText] = useState(false);
  const [text, setText] = useState(output?.text_content ?? "");
  const [isPending, startTransition] = useTransition();

  const uploading = progress !== null;

  if (disabled || !nodeId) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Sample output</span>
        <p className="rounded-lg border border-dashed border-border/70 bg-foreground/[0.02] px-3 py-2.5 text-sm text-muted-foreground">
          Save the step first, then add a sample output.
        </p>
      </div>
    );
  }

  function upload(file: File) {
    if (progress !== null) return; // an upload is already in flight — ignore re-fires
    setProgress(0);
    const form = new FormData();
    form.append("file", file);
    form.append("kind", inferKind(file));

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `/api/workflows/${workflowId}/nodes/${nodeId}/output`,
      true,
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success("Sample output added.");
        router.refresh();
      } else {
        let body: { error?: OutputError; limit?: string; filetype?: string } =
          {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          // non-JSON error body
        }
        toast.error(
          outputErrorMessage(body.error ?? "db_error", {
            limit: body.limit,
            filetype: body.filetype,
          }),
        );
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      toast.error(outputErrorMessage("db_error"));
    };
    xhr.send(form);
  }

  function onPick(file: File | null | undefined) {
    if (file) upload(file);
  }

  function onRemove() {
    startTransition(async () => {
      const r = await deleteOutputAction(workflowId, nodeId as string);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Sample output removed.");
      setText("");
      setShowText(false);
      router.refresh();
    });
  }

  function onSaveText() {
    startTransition(async () => {
      const r = await setTextOutputAction(workflowId, nodeId as string, text);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Sample output saved.");
      setShowText(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">Sample output</span>

      {uploading ? (
        <div className="rounded-lg border border-border/70 bg-foreground/[0.02] px-3 py-3">
          <p className="text-sm text-muted-foreground">Checking your file…</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-accent-foreground transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {progress}%
          </p>
        </div>
      ) : output ? (
        <OutputPreview output={output} />
      ) : showText ? (
        <div className="flex flex-col gap-2">
          <Textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the text this step produced."
            className="font-mono text-[12px] leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending || text.trim().length === 0}
              onClick={onSaveText}
            >
              Save text
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setShowText(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Dropzone
          inputId={inputId}
          inputRef={inputRef}
          dragOver={dragOver}
          setDragOver={setDragOver}
          onPick={onPick}
          onUseText={() => setShowText(true)}
        />
      )}

      {output && !uploading ? (
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
          >
            Replace
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={onRemove}
          >
            Remove
          </Button>
          {/* Hidden input drives the Replace button. */}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
        </div>
      ) : null}
    </div>
  );
}

function Dropzone({
  inputId,
  inputRef,
  dragOver,
  setDragOver,
  onPick,
  onUseText,
}: {
  inputId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onPick: (file: File | null | undefined) => void;
  onUseText: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop zone; the keyboard/click path is the labelled file input + "Paste text" button below */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onPick(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "rounded-lg border border-dashed px-3 py-5 text-center transition",
          dragOver
            ? "border-accent-foreground/60 bg-accent/40"
            : "border-border/70 bg-foreground/[0.02]",
        )}
      >
        <label
          htmlFor={inputId}
          className="cursor-pointer text-sm text-muted-foreground"
        >
          <span className="font-medium text-accent-foreground underline underline-offset-2">
            Choose a file
          </span>{" "}
          or drag it here
          <span className="mt-1 block text-xs">
            PNG, JPG, WebP, GIF, MP4, or PDF
          </span>
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
      </div>
      <button
        type="button"
        onClick={onUseText}
        className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Or paste text instead
      </button>
    </div>
  );
}
