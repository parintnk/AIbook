import { Play, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { type ThumbKind, thumbKit, thumbLabel, thumbWash } from "@/lib/explore";
import styles from "./explore.module.css";

const WASH_CLASS: Record<ReturnType<typeof thumbWash>, string> = {
  violet: styles.tViolet,
  teal: styles.tTeal,
  rose: styles.tRose,
  amber: styles.tAmber,
  indigo: styles.tIndigo,
  slate: styles.tSlate,
};

/** Decorative per-kind placeholder art (mockup `kit-*`). Hidden from a11y — the card title is the name. */
function KitDecoration({ kit }: { kit: "doc" | "logo" | "video" | "sheet" }) {
  switch (kit) {
    case "logo":
      return (
        <div className={styles.kitLogo} aria-hidden="true">
          <div className={styles.badge}>
            <Sparkles width={32} height={32} strokeWidth={2} />
          </div>
          <div className={styles.row}>
            <i style={{ background: "#E4E0FF" }} />
            <i style={{ background: "#6D5EF0" }} />
            <i style={{ background: "#A99BFF" }} />
            <i style={{ background: "#F5EFE6" }} />
          </div>
        </div>
      );
    case "video":
      return (
        <div className={styles.kitVideo} aria-hidden="true">
          <div className={styles.play}>
            <Play width={22} height={22} fill="currentColor" stroke="none" />
          </div>
          <div className={styles.scrub}>
            <b />
          </div>
        </div>
      );
    case "sheet":
      return (
        <div className={styles.kitSheet} aria-hidden="true">
          <div className={styles.hr}>
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className={styles.rw}>
            <i />
            <i />
            <i className={styles.pos} />
            <i />
          </div>
          <div className={styles.rw}>
            <i />
            <i className={styles.pos} />
            <i />
            <i />
          </div>
          <div className={styles.rw}>
            <i />
            <i />
            <i />
            <i className={styles.pos} />
          </div>
        </div>
      );
    default:
      return (
        <div className={styles.kitDoc} aria-hidden="true">
          <div className={styles.h} />
          <div className={`${styles.l} ${styles.m}`} />
          <div className={`${styles.l} ${styles.s}`} />
          <div className={`${styles.l} ${styles.m}`} />
          <div className={`${styles.l} ${styles.x}`} />
          <div className={`${styles.l} ${styles.acc}`} />
        </div>
      );
  }
}

/**
 * The feed-card thumbnail (output preview, UX-DR15). A real image output renders as an
 * `<img>`; every other kind (or a missing output) falls back to a deterministic gradient
 * wash + a per-kind kit decoration, so a text/file workflow still looks like the mockup.
 * `variant="rail"` is the shorter rail thumb (no output tag — the rail adds its own "New").
 */
export function WorkflowThumb({
  id,
  thumb,
  variant = "card",
  badge,
}: {
  id: string;
  thumb: { kind: ThumbKind | null; url: string | null };
  variant?: "card" | "rail";
  /** Optional overlay rendered inside the frame (e.g. the rail's "New" pill). */
  badge?: ReactNode;
}) {
  const frame = variant === "rail" ? styles.newthumb : styles.wthumb;

  if (thumb.kind === "image" && thumb.url) {
    return (
      <div className={frame}>
        {badge}
        {/* biome-ignore lint/performance/noImgElement: signed Supabase Storage URLs (arbitrary host) — next/image would need remote config; same rationale as ProfileAvatar. alt="" is intentional (decorative; the card title names it). */}
        <img src={thumb.url} alt="" referrerPolicy="no-referrer" />
        {variant === "card" ? (
          <span className={styles.tg}>output · image</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${frame} ${WASH_CLASS[thumbWash(id)]}`}>
      {badge}
      <KitDecoration kit={thumbKit(thumb.kind)} />
      {variant === "card" ? (
        <span className={styles.tg}>output · {thumbLabel(thumb.kind)}</span>
      ) : null}
    </div>
  );
}
