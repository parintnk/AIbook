import { redirect } from "next/navigation";

// The avatar-menu "Settings" entry lands on the Profile section.
export default function SettingsIndexPage() {
  redirect("/settings/profile");
}
