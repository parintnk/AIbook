import { FileText, Info, MessageSquare, Shield, Sparkles } from "lucide-react";
import Link from "next/link";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import type { ProfessionMod } from "@/lib/services/professions";
import styles from "./community.module.css";

/**
 * The community left rail (Story 6.2 / FR17) — the "home context". Four cards, each
 * rendered only when it has content (the 6.1 "no empty stubs" rule):
 *  - Mods: real `profession_members` read (moderator / verified_pro).
 *  - Start here: an INTERIM proxy (the profession's most-forked published workflows) —
 *    Epic 7.2 replaces it with mod-curated pins.
 *  - House rules: the 3 universal platform norms (DESIGN.md:174), static for now —
 *    Epic 7.2 makes them per-profession from `professions.rules`.
 *  - About: the profession description (+ a static AMA placeholder — no events system yet).
 */

const HOUSE_RULES: { title: string; body: string }[] = [
  {
    title: "Show real output.",
    body: "Every recipe needs a sample to publish.",
  },
  { title: "Credit your fork.", body: "Keep lineage intact when you remix." },
  {
    title: "Vote honestly.",
    body: "Worked / tweaks / didn't — it helps everyone.",
  },
];

function roleLabel(role: ProfessionMod["role"]): {
  shield: string;
  subtitle: string;
} {
  if (role === "moderator")
    return { shield: "Verified mod", subtitle: "Moderator" };
  if (role === "verified_pro")
    return { shield: "Verified", subtitle: "Verified pro" };
  return { shield: "Member", subtitle: "Member" };
}

export function CommunityRail({
  mods,
  canon,
  description,
}: {
  mods: ProfessionMod[];
  canon: { id: string; title: string }[];
  description: string | null;
}) {
  return (
    <aside className={styles.rail}>
      {mods.length > 0 ? (
        <div className={styles.card}>
          <div className={styles.ct}>
            <Shield width={14} height={14} aria-hidden="true" />
            Mods
          </div>
          {mods.map((m) => {
            const { shield, subtitle } = roleLabel(m.role);
            return (
              <div key={m.profileId} className={styles.mod}>
                <ProfileAvatar
                  avatarUrl={m.avatarUrl}
                  displayName={m.displayName}
                  handle={m.handle ?? "?"}
                  className={styles.mav}
                />
                <div className={styles.mn}>
                  <div className={styles.mh}>
                    {m.handle ? `@${m.handle}` : "Moderator"}
                    <span className={styles.shield}>
                      <Shield width={9} height={9} aria-hidden="true" />
                      {shield}
                    </span>
                  </div>
                  <div className={styles.mr}>{subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {canon.length > 0 ? (
        <div className={styles.card}>
          <div className={styles.ct}>
            <Sparkles width={14} height={14} aria-hidden="true" />
            Start here
          </div>
          <ul className={styles.canon}>
            {canon.map((w, i) => (
              <li key={w.id}>
                <Link href={`/workflows/${w.id}`}>
                  <span className={`${styles.cnum} font-mono`}>{i + 1}</span>
                  {w.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.card}>
        <div className={styles.ct}>
          <FileText width={14} height={14} aria-hidden="true" />
          House rules
        </div>
        <ul className={styles.rules}>
          {HOUSE_RULES.map((r) => (
            <li key={r.title}>
              <span className={styles.rn}>
                <CheckGlyph />
              </span>
              <span>
                <b>{r.title}</b> {r.body}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {description ? (
        <div className={styles.card}>
          <div className={styles.ct}>
            <Info width={14} height={14} aria-hidden="true" />
            About
          </div>
          <p className={styles.about}>{description}</p>
          <span className={styles.amapill}>
            <MessageSquare width={13} height={13} aria-hidden="true" />
            Community AMAs — coming soon
          </span>
        </div>
      ) : null}
    </aside>
  );
}

function CheckGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
