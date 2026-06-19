import { Compass, Library, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { WorkflowCard } from "@/components/workflows/workflow-card";
import type { WorkflowCardData } from "@/lib/explore";
import styles from "./onboarding.module.css";

/**
 * Onboarding step 3 (Story 12.1) — the preview + sign-up zone. Shows 3 REAL published workflows the
 * profession reaches for most (fetched by the page via `listPublishedWorkflows`, most-forked) via the
 * reused `WorkflowCard` (anon → `signedIn={false}`), then offers sign-up ONLY here (value-first). The
 * goal personalizes the copy (not a filter — v1). Sign-up carries the pick via `?next=` so the new
 * account lands relevant; ACTUAL `primary_profession_id` persistence is Story 12.2. NO Apple (only
 * Google + Email are wired). Pure (the page fetches; this renders).
 */
export function PreviewStep({
  professionName,
  goalTitle,
  workflows,
  signupNext,
}: {
  professionName: string;
  goalTitle: string;
  workflows: WorkflowCardData[];
  signupNext: string;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.phead}>
        <span className={styles.pno}>3</span>
        <div>
          <div className={styles.eyebrow}>
            Step 3 of 3 · No account needed yet
          </div>
          <h1 className={styles.h2}>
            Here's what {professionName}s reach for most.
          </h1>
          <p className={styles.ps}>
            Real recipes, with real outputs and honest results from the
            community.
          </p>
        </div>
      </div>

      <span className={styles.previewNote}>
        <Library width={14} height={14} aria-hidden="true" />
        Top recipes for <b>{goalTitle}</b> · {professionName}
      </span>

      {workflows.length > 0 ? (
        <div className={styles.wfgrid}>
          {workflows.map((w) => (
            <WorkflowCard key={w.id} data={w} signedIn={false} />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>
          No published recipes for this path yet —{" "}
          <Link className={styles.emptyLink} href="/explore">
            browse all workflows
          </Link>{" "}
          instead.
        </p>
      )}

      <div className={styles.signup}>
        <div className={styles.lead}>Like what you see? Save your spot.</div>
        <p className={styles.leadsub}>
          Create a free account to fork these, vote on what worked, and build
          your own.
        </p>
        <div className={styles.authcol}>
          <OAuthButtons next={signupNext} />
          <Link
            href={`/sign-up?next=${encodeURIComponent(signupNext)}`}
            className={styles.emailBtn}
          >
            Continue with Email
          </Link>
        </div>

        <span className={styles.honest}>
          <ShieldCheck width={15} height={15} aria-hidden="true" />
          No spam. You can{" "}
          <Link href="/explore">
            <Compass
              width={12}
              height={12}
              aria-hidden="true"
              style={{ display: "inline", verticalAlign: "-2px" }}
            />{" "}
            browse first
          </Link>
          .
        </span>

        <div className={styles.persist}>
          <ShieldCheck width={16} height={16} aria-hidden="true" />
          <span>
            We'll remember <b>{professionName}</b> and <b>{goalTitle}</b> when
            you sign in.
          </span>
        </div>
      </div>
    </section>
  );
}
