"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateSkeletonAction } from "@/app/(app)/workflows/actions";
import { AI_FEATURE_CAPS } from "@/lib/ai";
import { RateLimitNotice } from "./rate-limit-notice";
import styles from "./skeleton-intake.module.css";

/**
 * Story 11.2 — the AI Skeleton intake (the `.skeleton-intake` panel). Profession (from the draft,
 * read-only) + a one-sentence goal → `generateSkeletonAction` → the canvas re-seeds on `router.refresh()`.
 * At the daily cap it becomes the UX-DR21 disabled state (`RateLimitNotice`) — not an error. Author-only
 * by virtue of mounting only in the draft editor surface.
 */
export function SkeletonIntake({
  workflowId,
  professionName,
  usedToday,
}: {
  workflowId: string;
  professionName: string | null;
  usedToday: number;
}) {
  const router = useRouter();
  const limit = AI_FEATURE_CAPS.skeleton;
  const [goal, setGoal] = useState("");
  // Derive `limited` from the (refresh-updated) prop + a session rate-limit hit, so a successful
  // generate + router.refresh() re-syncs it (a once-seeded useState would go stale at "5/5").
  const [rateLimitedHit, setRateLimitedHit] = useState(false);
  const limited = usedToday >= limit || rateLimitedHit;
  const [pending, startTransition] = useTransition();

  function generate() {
    if (pending || limited || !goal.trim()) return;
    startTransition(async () => {
      const res = await generateSkeletonAction(workflowId, { goal });
      if (res.rateLimited) {
        setRateLimitedHit(true);
        return;
      }
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.success) {
        toast.success("Skeleton added — edit the steps to make them yours.");
        setGoal("");
        router.refresh();
      }
    });
  }

  return (
    <section className={styles.intake} aria-label="AI Skeleton generator">
      <div className={styles.head}>
        <span className={styles.spark}>
          <Sparkles width={15} height={15} aria-hidden="true" />
        </span>
        <span className={styles.title}>AI Skeleton</span>
        {!limited && (
          <span className={styles.usage}>
            {usedToday}/{limit} today
          </span>
        )}
      </div>
      <p className={styles.sub}>
        Seed the canvas with a starting set of steps from your profession +
        goal.
      </p>
      {limited ? (
        <RateLimitNotice feature="skeleton" limit={limit} />
      ) : (
        <>
          {professionName && (
            <div className={styles.chip}>Profession: {professionName}</div>
          )}
          <label className={styles.field}>
            <span className={styles.lead}>Goal</span>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  generate();
                }
              }}
              placeholder="one sentence…"
              maxLength={200}
              disabled={pending}
            />
          </label>
          <button
            type="button"
            className={styles.generate}
            onClick={generate}
            disabled={pending || !goal.trim()}
          >
            <Sparkles width={14} height={14} aria-hidden="true" />
            {pending ? "Drafting your skeleton…" : "Generate skeleton"}
          </button>
        </>
      )}
    </section>
  );
}
