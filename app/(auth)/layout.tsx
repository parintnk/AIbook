import type { ReactNode } from "react";
import { AuthValuePanel } from "@/components/auth/auth-value-panel";
import { BrandLogo } from "@/components/brand/brand-logo";

/**
 * Pre-auth shell: a brand lockup + the "why an account" value panel beside the
 * sign-in / sign-up card. Intentionally nav-less (no AppNav) — only the brand
 * links home. [Source: ux mockup auth-light.html — production elements only;
 * the side-by-side sign-in/sign-up in the mockup is an artboard, not a layout.]
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md lg:max-w-4xl">
        <div className="flex flex-col items-center gap-1.5 text-center lg:items-start lg:text-left">
          <BrandLogo />
          <p className="text-sm text-muted-foreground">
            A cookbook for AI workflows.
          </p>
        </div>
        <div className="mt-8 lg:grid lg:grid-cols-[0.85fr_1fr] lg:items-center lg:gap-12">
          <AuthValuePanel className="hidden lg:flex" />
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>
      </div>
    </main>
  );
}
