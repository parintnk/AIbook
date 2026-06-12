"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Temporary signed-in indicator near the theme toggle: shows the user's email +
 * a Sign out button when authed, a Sign in link otherwise. Replaced by the nav
 * shell / avatar menu in Story 1.6.
 *
 * Sign-out runs on the BROWSER client (not a server action): it fires
 * `onAuthStateChange` so `AuthProvider` clears the user immediately, while
 * `router.refresh()` re-renders any server-rendered authed UI. (A server-action
 * sign-out clears the cookie but leaves the client's auth state stale.)
 */
export function AuthStatus() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  // Avoid a flash of the wrong state before the client resolves the session.
  if (loading) return null;

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "glass rounded-full",
        )}
      >
        Sign in
      </Link>
    );
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
      router.refresh();
      router.push("/");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline">
        {user.email}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        disabled={signingOut}
        onClick={handleSignOut}
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
