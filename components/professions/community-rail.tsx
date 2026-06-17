import { FileText, Info, MessageSquare, Shield, Sparkles } from "lucide-react";
import Link from "next/link";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import type { HouseRule, ProfessionMod } from "@/lib/services/professions";
import styles from "./community.module.css";

/**
 * The community left rail (Story 6.2 + 7.2 / FR17) — the "home context". Four cards, each
 * rendered only when it has content (the 6.1 "no empty stubs" rule):
 *  - Mods: real `profession_members` read (moderator / verified_pro).
 *  - Start here: the profession's mod-curated pinned canon (Story 7.2 `profession_pins`).
 *  - House rules: the profession's own `rules` (Story 7.2), falling back to the 3 universal
 *    platform norms (DESIGN.md) when unset — parsed by `parseHouseRules` on the page.
 *  - About: the profession description (+ a static AMA placeholder — no events system yet).
 */

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
  rules,
  description,
}: {
  mods: ProfessionMod[];
  canon: { id: string; title: string }[];
  rules: HouseRule[];
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
        <div className={styles.card} data-testid="start-here">
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
          {rules.map((r, i) => (
            <li key={`${i}-${r.title}`}>
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
