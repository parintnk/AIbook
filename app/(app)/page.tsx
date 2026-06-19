import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

/**
 * Root `/`. An ANONYMOUS visitor is sent to the pre-auth choose-your-path onboarding (Story 12.1 / FR1
 * — "land cold → onboarding"); the current "Coming soon" splash was a dead-end. An AUTHENTICATED visitor
 * keeps the existing home unchanged (the authed home redesign is out of scope). Reading auth makes this
 * route dynamic — acceptable for a single gate + redirect.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/welcome");

  return (
    <main className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="glass flex max-w-xl flex-col items-center gap-6 rounded-card px-8 py-12">
        <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
          codename: idea
        </p>
        <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
          A cookbook for AI workflows
        </h1>
        <p className="max-w-md text-balance text-lg text-muted-foreground">
          Share, discover, and remix multi-tool AI recipes — organized by
          profession, with a real sample output on every step.
        </p>
        <Button size="lg">Coming soon</Button>
      </div>
    </main>
  );
}
