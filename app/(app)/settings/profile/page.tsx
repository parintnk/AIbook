import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import { listProfessions } from "@/lib/services/professions";
import { getMyProfile } from "@/lib/services/profiles";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit profile — idea" };

export default async function ProfileSettingsPage() {
  // Distinguish "not signed in" from "signed in but no profile row" so the
  // latter doesn't bounce to /sign-in forever (middleware would let them back).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/settings/profile");

  const profile = await getMyProfile();
  if (!profile) redirect("/"); // authed but profile-less (rare) — no edit target

  const professions = await listProfessions();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight">
            Profile
          </h2>
          <p className="mt-1 text-muted-foreground">
            This is how you appear across idea.
          </p>
        </div>
        <Link
          href={`/u/${profile.handle}`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          View public profile
        </Link>
      </div>

      <div className="mt-8">
        <ProfileForm
          profile={profile}
          professions={professions.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>
    </div>
  );
}
