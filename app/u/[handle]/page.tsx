import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { buttonVariants } from "@/components/ui/button";
import { getMyProfile, getProfileByHandle } from "@/lib/services/profiles";
import { cn } from "@/lib/utils";

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

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="glass flex flex-col gap-4 rounded-card p-6 sm:flex-row sm:items-start">
        <ProfileAvatar
          avatarUrl={profile.avatar_url}
          displayName={profile.display_name}
          handle={profile.handle}
          className="size-20 text-xl"
        />
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {profile.display_name ?? `@${profile.handle}`}
            </h1>
            <span className="font-mono text-sm text-muted-foreground">
              @{profile.handle}
            </span>
          </div>
          {profile.primary_profession ? (
            <span className="w-fit rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
              {profile.primary_profession.name}
            </span>
          ) : null}
          {profile.bio ? (
            <p className="text-pretty text-muted-foreground">{profile.bio}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {profile.hire_me_visible && profile.hire_me_url ? (
              <a
                href={profile.hire_me_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
              >
                Hire me
              </a>
            ) : null}
            {isOwner ? (
              <Link
                href="/settings/profile"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "rounded-full",
                )}
              >
                Edit profile
              </Link>
            ) : null}
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
