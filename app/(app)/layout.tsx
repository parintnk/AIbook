import type { ReactNode } from "react";
import { AppNav } from "@/components/nav/app-nav";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";

/**
 * App shell: the persistent glass top nav on every app surface, plus the mobile
 * bottom tab bar. The `(auth)` group has no layout, so sign-in/up render under
 * the root layout without the nav.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <AppNav />
      {/* pb clears the fixed bottom tab bar (h-16 + safe-area) below lg */}
      <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
