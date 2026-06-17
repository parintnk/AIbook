"use client";

import { Check, GitFork } from "lucide-react";
import Link from "next/link";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { type WorkflowCardData, workedPct } from "@/lib/explore";
import { CardSaveMark } from "./card-save-mark";
import styles from "./explore.module.css";
import { WorkflowThumb } from "./workflow-thumb";

/**
 * The Explore feed card (UX-DR15 / EXPERIENCE.md:113): output thumbnail + title + author +
 * community + fork count + worked-% chip. The WHOLE card is one click target → the workflow
 * detail page. The Save bookmark (Story 8.1) is a SIBLING overlay outside the <Link> (a button
 * inside an <a> is invalid HTML) so saving never navigates. Pure render from serializable
 * `WorkflowCardData` (reused for the SSR first page and client-appended pages alike).
 */
export function WorkflowCard({
  data,
  signedIn = false,
}: {
  data: WorkflowCardData;
  signedIn?: boolean;
}) {
  const pct = workedPct(data.workedScore, data.triedCount);
  return (
    <div className={styles.wfcardWrap}>
      <Link href={`/workflows/${data.id}`} className={styles.wfcard}>
        <WorkflowThumb id={data.id} thumb={data.thumb} />
        <h3 className={styles.wfTitle}>{data.title}</h3>
        <div className={styles.wauth}>
          {data.authorHandle ? (
            <>
              <ProfileAvatar
                avatarUrl={data.authorAvatarUrl}
                displayName={data.authorDisplayName}
                handle={data.authorHandle}
                className={styles.av}
              />
              <span className={styles.h}>@{data.authorHandle}</span>
            </>
          ) : null}
          {data.professionName ? (
            <span className={styles.commchip}>{data.professionName}</span>
          ) : null}
        </div>
        <div className={styles.wstats}>
          <span className={styles.statchip}>
            <GitFork width={13} height={13} aria-hidden="true" />{" "}
            <b className={styles.mono}>{data.forkCount}</b> forks
          </span>
          {pct !== null ? (
            <span className={styles.score}>
              <Check
                width={12}
                height={12}
                strokeWidth={2.4}
                aria-hidden="true"
              />
              {pct}% worked
            </span>
          ) : null}
        </div>
      </Link>
      <CardSaveMark
        workflowId={data.id}
        signedIn={signedIn}
        initialSaved={data.saved ?? false}
      />
    </div>
  );
}
