import { redirect } from "next/navigation";

/**
 * Root `/` → the public Explore feed, the home for EVERYONE (anon can browse the
 * cookbook freely). `/welcome` is the choose-your-path onboarding for new sign-ups —
 * reached intentionally (a "Get started" / sign-up CTA, or right after registering),
 * NOT forced on every anonymous visitor. No auth read → a plain static redirect.
 */
export default function Home() {
  redirect("/explore");
}
