import { professionIcon } from "@/lib/profession-icons";
import type { Profession } from "@/lib/services/professions";
import styles from "./community.module.css";
import { InviteButton } from "./invite-button";
import { JoinButton } from "./join-button";

/**
 * The profession community hero (Story 6.2 / FR17 "home not shelf"). An accent-tinted
 * banner: profession icon (slug→lucide) + name + member-count pill + description, with the
 * Join/Joined control + Invite (copy-link). Server-rendered; the Join/Invite buttons are
 * client islands. Member status is resolved server-side and passed down (no client probe).
 */
export function ProfessionHero({
  profession,
  isAuthed,
  isMember,
  canLeave,
}: {
  profession: Profession;
  isAuthed: boolean;
  isMember: boolean;
  canLeave: boolean;
}) {
  const Icon = professionIcon(profession.slug);
  return (
    <div className={styles.commhero}>
      <div className={styles.inner}>
        <div className={styles.ci}>
          <Icon width={34} height={34} aria-hidden="true" />
        </div>
        <div className={styles.htxt}>
          <div className={styles.toprow}>
            <h1 className={styles.htitle}>{profession.name}</h1>
            <span className={styles.members}>
              <b className="font-mono">
                {profession.member_count.toLocaleString("en-US")}
              </b>{" "}
              {profession.member_count === 1 ? "member" : "members"}
            </span>
          </div>
          {profession.description ? (
            <p className={styles.desc}>{profession.description}</p>
          ) : null}
        </div>
        <div className={styles.hactions}>
          <JoinButton
            professionId={profession.id}
            professionSlug={profession.slug}
            initialJoined={isMember}
            isAuthed={isAuthed}
            canLeave={canLeave}
          />
          <InviteButton slug={profession.slug} />
        </div>
      </div>
    </div>
  );
}
