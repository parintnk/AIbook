import { Check } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "@/components/profile/profile.module.css";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { ProfileSocial } from "@/components/profile/profile-social";
import { getFollowState } from "@/lib/services/follows";
import {
  getMyProfile,
  getProfileByHandle,
  isVerifiedCreator,
} from "@/lib/services/profiles";

type Params = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);
  if (!profile) return { title: "Profile not found — idea" };
  const name = profile.display_name ?? `@${profile.handle}`;
  return {
    title: `${name} (@${profile.handle}) — idea`,
    description: profile.bio ?? undefined,
  };
}

const STATS = [
  { label: "Workflows", value: 0 },
  { label: "Forks", value: 0 },
  { label: "Worked", value: "—" },
] as const;

export default async function PublicProfilePage({ params }: Params) {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);
  if (!profile) notFound();

  const me = await getMyProfile();
  const isOwner = me?.id === profile.id;
  // Verified badge (derived — a verified_pro in any profession) + my follow-state, in parallel.
  const [verified, following] = await Promise.all([
    isVerifiedCreator(profile.id),
    me && !isOwner ? getFollowState(profile.id) : Promise.resolve(false),
  ]);

  const joinedLabel = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      {/* Hero (Story 9.1 — 100% fidelity to profile-{light,dark}.html) */}
      <header className={styles.cover}>
        <div className={styles.phead}>
          <div className={styles.pavatar}>
            <ProfileAvatar
              avatarUrl={profile.avatar_url}
              displayName={profile.display_name}
              handle={profile.handle}
              className="size-full rounded-[30px] text-4xl"
            />
            {verified ? (
              <span className={styles.verified}>
                <Check
                  width={16}
                  height={16}
                  strokeWidth={2.6}
                  aria-hidden="true"
                />
                <span className="sr-only">Verified pro</span>
              </span>
            ) : null}
          </div>
          <div className={styles.pinfo}>
            <div className={styles.pnameRow}>
              <h1 className={styles.pname}>
                {profile.display_name ?? `@${profile.handle}`}
              </h1>
              <span className={styles.phandle}>@{profile.handle}</span>
              {profile.primary_profession ? (
                <span className={styles.profession}>
                  {profile.primary_profession.name}
                </span>
              ) : null}
            </div>
            {profile.bio ? <p className={styles.pbio}>{profile.bio}</p> : null}
            <ProfileSocial
              targetId={profile.id}
              targetHandle={profile.handle}
              isOwner={isOwner}
              signedIn={Boolean(me)}
              viewerId={me?.id ?? null}
              initialFollowing={following}
              followerCount={profile.follower_count}
              followingCount={profile.following_count}
              joinedLabel={joinedLabel}
              hireMeUrl={profile.hire_me_url}
              hireMeVisible={profile.hire_me_visible}
            />
          </div>
        </div>
      </header>

      {/* Contribution stats — placeholders until later epics wire real data. */}
      <section className="mt-6 grid grid-cols-3 gap-3">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="glass flex flex-col items-center gap-1 rounded-2xl p-4"
          >
            <span className="font-mono text-2xl font-semibold">{s.value}</span>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {s.label}
            </span>
          </div>
        ))}
      </section>

      {/* AI Stack */}
      <section className="mt-6">
        <h2 className="font-heading text-lg font-medium">AI Stack</h2>
        {profile.ai_stack_items.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No tools listed yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {profile.ai_stack_items.map((item) => (
              <li
                key={item.id}
                className="glass flex items-center gap-2 rounded-full px-3 py-1.5"
              >
                <span className="font-mono text-sm">{item.tool_name}</span>
                <span
                  role="img"
                  className="text-xs text-muted-foreground"
                  aria-label={`Skill level ${item.skill_level} of 5`}
                >
                  {"●".repeat(item.skill_level)}
                  {"○".repeat(5 - item.skill_level)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
