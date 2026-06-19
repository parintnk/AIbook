"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const KEY = "idea:onboarding";

/**
 * Client-side resume of an abandoned onboarding pick (Story 12.2 / AC2). While the anon visitor is on
 * step 2/3 (a profession is chosen) the selection is mirrored to `localStorage`; on a cold return to
 * step 1 it's consumed and the visitor is bounced back to where they left off. 12.1 validates the
 * restored slug, so a stale value just falls through to a fresh step 1.
 *
 * ponytail: localStorage is the entire persistence layer (no cookie, no server). consume-on-restore
 * (removeItem before the redirect) is the loop guard — a stale slug can't re-trigger the bounce.
 */
export function OnboardingResume({
  profession,
  goal,
}: {
  profession: string | null;
  goal: string | null;
}) {
  const router = useRouter();
  useEffect(() => {
    try {
      if (profession) {
        localStorage.setItem(KEY, JSON.stringify({ profession, goal }));
        return;
      }
      const saved = localStorage.getItem(KEY);
      if (!saved) return;
      localStorage.removeItem(KEY);
      const { profession: p, goal: g } = JSON.parse(saved);
      if (p) {
        const q = g ? `&goal=${encodeURIComponent(g)}` : "";
        router.replace(`/welcome?profession=${encodeURIComponent(p)}${q}`);
      }
    } catch {
      // ponytail: storage disabled (private mode) or a corrupt value — onboarding must not break.
    }
  }, [profession, goal, router]);
  return null;
}
