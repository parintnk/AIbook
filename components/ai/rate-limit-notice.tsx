import { Clock } from "lucide-react";
import { type AiFeature, rateLimitCopy } from "@/lib/ai";
import styles from "./ai-usage.module.css";

/**
 * The UX-DR21 rate-limited DISABLED state (Story 11.1) — a quiet amber affordance, NOT a hard error.
 * An AI trigger (11.2 Skeleton / 11.3 Doctor) renders this beside its disabled button when the user
 * has hit today's cap. Presentational + static (no animation → reduced-motion-compliant by construction);
 * announced politely via `role="status"` + `aria-live`.
 */
export function RateLimitNotice({
  feature,
  limit,
}: {
  feature: AiFeature;
  limit: number;
}) {
  return (
    <output className={styles.rateLimit} aria-live="polite">
      <Clock width={15} height={15} aria-hidden="true" />
      <span>{rateLimitCopy({ feature, limit })}</span>
    </output>
  );
}
