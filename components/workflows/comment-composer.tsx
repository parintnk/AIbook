"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * The comment composer (Story 4.2 / UX-DR19). Auto-growing textarea + "Post" — used for
 * the top-level composer and (compact `reply` variant) the inline reply box. Anon sees a
 * "Sign in to comment" affordance instead (mirrors 4.1's "Sign in to vote"). ⌘/Ctrl+Enter
 * posts. The body is capped at 2000 chars (matches the DB CHECK).
 */

const PLACEHOLDER = "Share what worked, or what you'd tweak…";

export function CommentComposer({
  onSubmit,
  canComment,
  pending = false,
  variant = "default",
  onCancel,
}: {
  onSubmit: (body: string) => void;
  canComment: boolean;
  pending?: boolean;
  variant?: "default" | "reply";
  onCancel?: () => void;
}) {
  const [body, setBody] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const isReply = variant === "reply";

  if (!canComment) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 px-4 py-3.5 text-[13px] text-muted-foreground">
        <Link
          href="/sign-in"
          className="font-medium text-accent-foreground underline underline-offset-2"
        >
          Sign in to comment
        </Link>{" "}
        on this workflow.
      </div>
    );
  }

  const trimmed = body.trim();

  function grow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function submit() {
    if (!trimmed || pending) return;
    onSubmit(trimmed);
    setBody("");
    if (taRef.current) taRef.current.style.height = "auto";
  }

  return (
    <div
      className={
        isReply
          ? "mt-3 rounded-xl border border-border bg-card/40 p-2.5"
          : "flex gap-3 rounded-2xl border border-border bg-card/50 p-3.5 shadow-sm"
      }
    >
      {isReply ? null : (
        <div
          aria-hidden="true"
          className="size-10 shrink-0 rounded-full bg-gradient-to-br from-[#9D8FFF] to-[#6366F1] shadow-sm"
        />
      )}
      <div className="flex flex-1 flex-col gap-2.5">
        <textarea
          ref={taRef}
          value={body}
          // biome-ignore lint/a11y/noAutofocus: the reply box is user-triggered; focusing it is the expected affordance
          autoFocus={isReply}
          onChange={(e) => {
            setBody(e.target.value);
            grow();
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          rows={2}
          maxLength={2000}
          placeholder={isReply ? "Write a reply…" : PLACEHOLDER}
          className="min-h-[44px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-[14px] outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {isReply ? (
            <span />
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <BulbIcon className="size-3.5 shrink-0 text-accent-foreground" />
              Be specific — did it work? what did you change?
            </span>
          )}
          <div className="flex items-center gap-1.5">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg px-3 py-1.5 font-medium text-[13px] text-muted-foreground transition hover:text-foreground"
              >
                Cancel
              </button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={!trimmed || pending}
              onClick={submit}
              className="gap-1.5"
            >
              <SendIcon className="size-3.5" />
              Post
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BulbIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}
