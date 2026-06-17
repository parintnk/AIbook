import { FileText, Info, MessageSquare, Shield, Sparkles } from "lucide-react";
import Link from "next/link";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import type {
  HouseRule,
  ProfessionMod,
  ProfessionPin,
} from "@/lib/services/professions";
import styles from "./community.module.css";
import { EditRulesDialog } from "./edit-rules-dialog";
import { PinWorkflowDialog } from "./pin-workflow-dialog";
import { SortableCanon } from "./sortable-canon";

/**
 * The community left rail (Story 6.2 + 7.2 + 7.3 / FR17/FR18) — the "home context". Cards render only
 * when they have content (the 6.1 "no empty stubs" rule):
 *  - Mods: real `profession_members` read (moderator / verified_pro).
 *  - Start here: the profession's mod-curated pinned canon (Story 7.2 `profession_pins`). For a
 *    MODERATOR (Story 7.3) the card is editable — drag-reorder + unpin + a "Pin a workflow" picker —
 *    and shows even when empty (so a mod can add the first pin); members get the plain read-only list.
 *  - House rules: the profession's own `rules` (Story 7.2); a moderator gets an "Edit" affordance (7.3).
 *  - About: the profession description (+ a static AMA placeholder — no events system yet).
 *
 * `isModerator` is server-derived (the `isProfessionModerator` RPC on the page). When false, NO mod
 * chrome renders — no buttons, no disabled controls, no "access denied" (UX-DR21); the member sees
 * exactly the 6.2/7.2 rail, and the @dnd-kit / dialog client bundles never load.
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
  isModerator = false,
  professionId,
  pinnable = [],
}: {
  mods: ProfessionMod[];
  canon: ProfessionPin[];
  rules: HouseRule[];
  description: string | null;
  isModerator?: boolean;
  professionId: string;
  pinnable?: ProfessionPin[];
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

      {/* Start here — editable for a moderator (Story 7.3), read-only for members (Story 7.2). */}
      {isModerator ? (
        <div className={styles.card} data-testid="start-here">
          <div className={`${styles.ct} ${styles.ctMod}`}>
            <span className={styles.ctLabel}>
              <Sparkles width={14} height={14} aria-hidden="true" />
              Start here
            </span>
            <PinWorkflowDialog
              professionId={professionId}
              pinnable={pinnable}
              pinnedIds={canon.map((w) => w.id)}
            />
          </div>
          {canon.length > 0 ? (
            <SortableCanon professionId={professionId} canon={canon} />
          ) : (
            <p className={styles.canonEmpty}>
              No pins yet — add the first essential workflow newcomers should
              try.
            </p>
          )}
        </div>
      ) : canon.length > 0 ? (
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
        {isModerator ? (
          <div className={`${styles.ct} ${styles.ctMod}`}>
            <span className={styles.ctLabel}>
              <FileText width={14} height={14} aria-hidden="true" />
              House rules
            </span>
            <EditRulesDialog professionId={professionId} rules={rules} />
          </div>
        ) : (
          <div className={styles.ct}>
            <FileText width={14} height={14} aria-hidden="true" />
            House rules
          </div>
        )}
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
