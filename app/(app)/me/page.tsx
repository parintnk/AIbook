import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/services/profiles";

/**
 * Indirection so the avatar menu's "My profile" + the mobile Profile tab can
 * link to a static `/me` without threading the handle through the client.
 */
export default async function MePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/sign-in?next=/me");
  redirect(`/u/${profile.handle}`);
}
