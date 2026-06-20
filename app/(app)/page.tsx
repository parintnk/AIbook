import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Root `/`. Anonymous visitors go to the pre-auth choose-your-path onboarding
 * (Story 12.1 / FR1 — "land cold → onboarding"); authenticated visitors go to the
 * Explore feed (the home). The old "Coming soon" splash was a dead-end. Reading auth
 * makes this route dynamic — fine for a single gate + redirect.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/explore" : "/welcome");
}
