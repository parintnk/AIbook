import { Check, GitFork, Layers, LayoutGrid, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "@/components/profile/profile.module.css";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { ProfileBadges } from "@/components/profile/profile-badges";
import { ProfileHeatmap } from "@/components/profile/profile-heatmap";
import { ProfilePublishedFeed } from "@/components/profile/profile-published-feed";
import { ProfileSocial } from "@/components/profile/profile-social";
import { deriveBadges } from "@/lib/profile-badges";
import { getProfileActivity } from "@/lib/services/activity";
import { getSavedWorkflowIds } from "@/lib/services/boards";
import { getFollowState } from "@/lib/services/follows";
import {
  getMyProfile,
  getProfileByHandle,
  isVerifiedCreator,
} from "@/lib/services/profiles";
import {
  getAuthorPublishedStats,
  listPublishedByAuthor,
} from "@/lib/services/workflows";

type Params = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);
  if (!profile) return { title: "Profile not found — idea" };
  const name = profile.display_name ?? `@${profile.handle}`;
  const title = `${name} (@${profile.handle}) — idea`;
  const description = profile.bio ?? undefined;
  return {
    title,
    description,
    openGraph: { type: "profile", title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicProfilePage({ params }: Params) {
  const { handle } = await params;
  // The public profile + the viewer's own profile are independent — fetch in parallel.
  const [profile, me] = await Promise.all([
    getProfileByHandle(handle),
    getMyProfile(),
  ]);
  if (!profile) notFound();

  const isOwner = me?.id === profile.id;
  // Verified badge + follow-state + stats + activity calendar + first page of published, in parallel.
  const [verified, following, stats, activity, published] = await Promise.all([
    isVerifiedCreator(profile.id),
    me && !isOwner ? getFollowState(profile.id) : Promise.resolve(false),
    getAuthorPublishedStats(profile.id),
    getProfileActivity(profile.id),
    listPublishedByAuthor({ authorId: profile.id }),
  ]);
  const masterTools = profile.ai_stack_items
    .filter((i) => i.skill_level >= 5)
    .map((i) => i.tool_name);
  const badges = deriveBadges({ verified, stats, masterTools });
  // Bookmark state for the SSR cards (empty for anon) — appended pages enrich in the action.
  const savedIds = await getSavedWorkflowIds(published.items.map((i) => i.id));
  const publishedItems = published.items.map((i) => ({
    ...i,
    saved: savedIds.has(i.id),
  }));

  const statTiles = [
    { label: "Published", value: stats.published, icon: LayoutGrid },
    { label: "Forks received", value: stats.forksReceived, icon: GitFork },
    {
      label: "Worked rate",
      value: stats.workedPct === null ? "—" : `${stats.workedPct}%`,
      icon: Check,
    },
    { label: "Followers", value: profile.follower_count, icon: Users },
  ] as const;

  const joinedLabel = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
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

      {/* Real contribution stats (Story 9.x) — derived from the author's published rows. */}
      <section className={`${styles.statGrid} mt-6`}>
        {statTiles.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`${styles.tile} ${styles.stat}`}>
              <span className={styles.statIc}>
                <Icon width={16} height={16} aria-hidden="true" />
              </span>
              <span className={`${styles.statNum} font-mono`}>{s.value}</span>
              <span className={styles.statLbl}>{s.label}</span>
            </div>
          );
        })}
      </section>

      {/* Contribution heatmap — real activity (publishes + comments + votes). */}
      <section className="mt-4">
        <ProfileHeatmap calendar={activity} />
      </section>

      {/* My AI Stack (skill bars) + auto-awarded Badges, side by side. */}
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        {profile.ai_stack_items.length > 0 ? (
          <div className={styles.tile}>
            <div className={styles.tileH}>
              <span className={styles.tileGlyph}>
                <Layers width={18} height={18} aria-hidden="true" />
              </span>
              <h2 className={styles.tileTitle}>My AI Stack</h2>
              <span className={styles.tileNote}>Self-rated</span>
            </div>
            <p className={styles.stackSub}>
              The exact tools {profile.display_name ?? `@${profile.handle}`}{" "}
              reaches for, with honest skill levels.
            </p>
            <div className={styles.stackList}>
              {profile.ai_stack_items.map((item) => (
                <div key={item.id} className={styles.stackRow}>
                  <div className={styles.stackTop}>
                    <span className={styles.toolLogo}>
                      {item.tool_name.charAt(0).toUpperCase()}
                    </span>
                    <span className={styles.toolName}>{item.tool_name}</span>
                    <span className={styles.skPct}>{item.skill_level}/5</span>
                  </div>
                  <div className={styles.skBar}>
                    <span
                      style={{ width: `${(item.skill_level / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <ProfileBadges badges={badges} />
      </section>

      {/* Contributions — the author's published workflows (most forked first). */}
      <section className="mt-8">
        <h2 className="font-heading text-lg font-medium">
          Published
          <span className="ml-2 font-mono text-sm text-muted-foreground">
            {published.total}
          </span>
        </h2>
        <div className="mt-4">
          <ProfilePublishedFeed
            authorId={profile.id}
            initialItems={publishedItems}
            total={published.total}
            signedIn={Boolean(me)}
            isOwner={isOwner}
          />
        </div>
      </section>
    </main>
  );
}
