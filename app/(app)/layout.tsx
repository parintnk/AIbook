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
      {/* pb leaves room for the fixed mobile bottom tab bar */}
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <BottomTabBar />
    </div>
  );
}
