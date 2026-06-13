import type { ReactNode } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";

/**
 * Settings "control room": a sticky section nav + the active section's content.
 * [Source: ux mockup settings-light.html]
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">
        Settings
      </h1>
      <div className="mt-8 md:grid md:grid-cols-[180px_1fr] md:gap-10">
        <SettingsNav />
        <div className="mt-6 max-w-2xl md:mt-0">{children}</div>
      </div>
    </div>
  );
}
