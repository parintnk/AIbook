import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/services/profiles";

/**
 * Indirection so the avatar menu's "My profile" + the mobile Profile tab can
 * link to a static `/me` without threading the handle through the client.
 */
export default async function MePage() {
  const profile = await getMyProfile();
  if (profile) redirect(`/u/${profile.handle}`);
  // Middleware gates /me to authenticated users, so a missing profile here means
  // "signed in but the signup trigger skipped the insert" — send them to create
  // one. Never redirect to /sign-in: it bounces an authed user back to /me (loop).
  redirect("/settings/profile");
}
