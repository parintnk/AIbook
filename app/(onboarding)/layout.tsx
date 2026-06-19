import type { ReactNode } from "react";

/**
 * Pre-auth, chrome-less onboarding shell (Story 12.1 / FR1). Intentionally nav-less — no AppNav /
 * BottomTabBar (mirrors the `(auth)` pre-auth pattern) — because the 3-step choose-your-path flow runs
 * BEFORE sign-up. Full-width centered wrap (the mockup's 920px) for the profession/goal/preview panels;
 * the brand mark + step indicator live in the page (the indicator is step-aware). Public by default
 * (the path isn't a PROTECTED_PREFIX → no middleware change).
 */
export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center px-6 py-9">
      <div className="w-full max-w-[920px]">{children}</div>
    </main>
  );
}
