import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import { getMyProfile } from "@/lib/services/profiles";

export const metadata = { title: "Edit profile — idea" };

export default async function ProfileSettingsPage() {
  const profile = await getMyProfile();
  // Middleware already gates /settings; this also covers the no-profile edge.
  if (!profile) redirect("/sign-in?next=/settings/profile");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Edit profile
          </h1>
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
        <ProfileForm profile={profile} />
      </div>
    </main>
  );
}
