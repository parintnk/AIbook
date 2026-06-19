"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Constrains the workflows workspace (list / new / view) to the app's 1180px content
 * column — EXCEPT the draft editor (`/workflows/{id}/edit`), which goes full-bleed so
 * the canvas can fill the viewport below the nav (no page scroll). The editor owns its
 * own height; every other surface keeps the centred column.
 */
export default function WorkflowsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isEditor = /\/workflows\/[^/]+\/edit$/.test(pathname);

  if (isEditor) return <>{children}</>;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-8">{children}</div>
  );
}
