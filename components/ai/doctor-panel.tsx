"use client";

import {
  ArrowRight,
  Check,
  Info,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reviewWorkflowAction } from "@/app/(app)/workflows/actions";
import { type DoctorNodeVerdict, type DoctorReview, flagLabel } from "@/lib/ai";
import { useCanvasStore } from "@/lib/stores/canvas-store";
import { cn } from "@/lib/utils";
import styles from "./doctor-panel.module.css";
import { RateLimitNotice } from "./rate-limit-notice";

/**
 * Story 11.3 — the Workflow Doctor panel (`.doctor`). An ADVISORY pre-publish review: "Review before
 * publish" → `reviewWorkflowAction` (Gemini, rate-limited via the 11.1 quota, cap 10) → per-node
 * pass/flag rows; each flag is specific + actionable and links to its node (`setSelected`). At the daily
 * cap it becomes the UX-DR21 disabled state (`RateLimitNotice`) — not an error. Advisory ONLY — an
 * advisory footer states it never blocks publish (only the FR10 real-output rule does). Re-runnable
 * (a 2nd run replaces the result). Author-only by virtue of mounting in the draft editor surface.
 */
export function DoctorPanel({
  workflowId,
  usedToday,
  limit,
}: {
  workflowId: string;
  usedToday: number;
  limit: number;
}) {
  const [review, setReview] = useState<DoctorReview | null>(null);
  // Derive `limited` from the prop + in-session successful runs + a server rate-limit hit (the 11.2
  // derive-not-seed pattern). Counting `ranThisSession` keeps the badge truthful (each run consumed a
  // unit server-side) and self-limits at the cap without waiting for the server's rateLimited signal.
  const [rateLimitedHit, setRateLimitedHit] = useState(false);
  const [ranThisSession, setRanThisSession] = useState(0);
  const used = usedToday + ranThisSession;
  const limited = used >= limit || rateLimitedHit;
  const [pending, startTransition] = useTransition();

  function runReview() {
    if (pending || limited) return;
    startTransition(async () => {
      const res = await reviewWorkflowAction(workflowId);
      if (!res.ok) {
        if (res.rateLimited) {
          setRateLimitedHit(true);
          return;
        }
        if (res.error) toast.error(res.error);
        return;
      }
      setReview(res.review);
      setRanThisSession((n) => n + 1);
    });
  }

  const reviewed = review !== null;

  return (
    <section className={styles.doctor} aria-label="Workflow Doctor">
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.title}>
            <span className={styles.ic}>
              <ShieldCheck width={16} height={16} aria-hidden="true" />
            </span>
            Workflow Doctor
          </span>
          {!limited && (
            <span className={styles.usage}>
              {used}/{limit} today
            </span>
          )}
        </div>
        {/* aria-live so the resolved score announces politely (UX-DR23). */}
        <div className={styles.score} aria-live="polite">
          {reviewed ? (
            <>
              <span className={styles.pill}>{review.pass} pass</span>
              {review.flag > 0 && (
                <span className={cn(styles.pill, styles.warn)}>
                  {review.flag} flag
                </span>
              )}
              <span>· reviewed just now</span>
            </>
          ) : (
            <span>Advisory review across 4 checks per step.</span>
          )}
        </div>
      </div>

      {limited ? (
        <div className={styles.actions}>
          <RateLimitNotice feature="doctor" limit={limit} />
        </div>
      ) : (
        <>
          {reviewed && (
            <div className={styles.list}>
              {review.nodes.map((n) => (
                <NodeRow key={n.nodeId} verdict={n} dim={pending} />
              ))}
            </div>
          )}
          {pending && !reviewed && (
            <p className={styles.reviewing}>Reviewing your steps…</p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.review}
              onClick={runReview}
              disabled={pending}
            >
              <ShieldCheck width={14} height={14} aria-hidden="true" />
              {pending
                ? "Reviewing…"
                : reviewed
                  ? "Re-run review"
                  : "Review before publish"}
            </button>
          </div>
        </>
      )}

      <div className={styles.foot}>
        <div className={styles.advisory}>
          <Info
            width={14}
            height={14}
            aria-hidden="true"
            className={styles.advIc}
          />
          <span>
            <b>Advisory only</b> — Doctor never blocks publish; only the
            real-output rule does.
          </span>
        </div>
      </div>
    </section>
  );
}

/** One per-node verdict row (`.dnode`). `dim` shimmers it during an in-flight re-run (UX-DR23). */
function NodeRow({
  verdict,
  dim,
}: {
  verdict: DoctorNodeVerdict;
  dim: boolean;
}) {
  const flagged = verdict.status === "flag";
  const stepNum = verdict.idx + 1;
  return (
    <div
      className={cn(
        styles.dnode,
        flagged && styles.flag,
        dim && styles.shimmer,
      )}
    >
      <div className={styles.dnTop}>
        <span
          className={cn(
            styles.badge,
            flagged ? styles.badgeWarn : styles.badgeOk,
          )}
        >
          {flagged ? (
            <TriangleAlert width={13} height={13} aria-hidden="true" />
          ) : (
            <Check width={13} height={13} aria-hidden="true" />
          )}
        </span>
        <span className={styles.dnName}>
          <span className={styles.num}>{stepNum}</span> ·{" "}
          {verdict.stepTitle || "Untitled step"}
        </span>
        <span
          className={cn(
            styles.dnStatus,
            flagged ? styles.statusWarn : styles.statusOk,
          )}
        >
          {flagged
            ? `${verdict.flags.length} flag${verdict.flags.length === 1 ? "" : "s"}`
            : "Pass"}
        </span>
      </div>

      {flagged && verdict.flags.length > 0 && (
        <div className={styles.dnFlags}>
          {verdict.flags.map((f) => (
            <div
              key={f.check}
              className={cn(styles.dnFlag, f.required && styles.req)}
            >
              <span className={styles.fdot} aria-hidden="true">
                {f.required ? (
                  // ✕ for the FR10 req-flag (the mockup's `.req` glyph)
                  <svg
                    width={9}
                    height={9}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.6}
                    strokeLinecap="round"
                  >
                    <title>Required</title>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                ) : (
                  // ! for an advisory flag
                  <svg
                    width={9}
                    height={9}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.6}
                    strokeLinecap="round"
                  >
                    <title>Flag</title>
                    <path d="M12 8v5M12 17h.01" />
                  </svg>
                )}
              </span>
              <span>
                <b>{flagLabel(f.check)}</b> — {f.message}
              </span>
            </div>
          ))}
          <button
            type="button"
            className={styles.dnLink}
            onClick={() =>
              useCanvasStore.getState().setSelected(verdict.nodeId)
            }
          >
            Jump to node {stepNum}
            <ArrowRight width={11} height={11} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
