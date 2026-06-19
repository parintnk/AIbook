import { Check } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import styles from "./onboarding.module.css";

/**
 * The pre-auth brand lockup + the 1·2·3 step indicator (Story 12.1). Step-aware: the current step is
 * `cur`, completed steps are `done` and link BACK to their URL state (the flow is URL-driven, DR-5).
 */
const STEPS = [
  { n: 1 as const, label: "Profession" },
  { n: 2 as const, label: "Goal" },
  { n: 3 as const, label: "Preview" },
];

export function OnboardingHeader({
  step,
  professionSlug,
}: {
  step: 1 | 2 | 3;
  professionSlug?: string | null;
}) {
  function backHref(n: number): string | null {
    if (n >= step) return null; // current/future steps don't link
    if (n === 1) return "/welcome";
    if (n === 2 && professionSlug)
      return `/welcome?profession=${professionSlug}`;
    return null;
  }

  return (
    <div className={styles.brandbar}>
      <span className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>idea</title>
            <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v16H5.5A2.5 2.5 0 0 0 3 21.5z" />
            <path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H12v16h6.5a2.5 2.5 0 0 1 2.5 2.5z" />
          </svg>
        </span>
        idea <span className={styles.codename}>codename</span>
      </span>
      <nav className={styles.steps} aria-label="Onboarding progress">
        {STEPS.map((s, i) => {
          const state = s.n === step ? "cur" : s.n < step ? "done" : undefined;
          const href = backHref(s.n);
          const inner = (
            <>
              <span className={styles.dot}>
                {s.n < step ? (
                  <Check width={13} height={13} aria-hidden="true" />
                ) : (
                  s.n
                )}
              </span>
              <span className={styles.lbl}>{s.label}</span>
            </>
          );
          return (
            <Fragment key={s.n}>
              {i > 0 ? (
                <span className={cn(styles.bar, s.n <= step && styles.fill)} />
              ) : null}
              <span
                className={cn(styles.s, state && styles[state])}
                aria-current={s.n === step ? "step" : undefined}
              >
                {href ? (
                  <Link href={href} className={styles.stepLink}>
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </span>
            </Fragment>
          );
        })}
      </nav>
    </div>
  );
}
