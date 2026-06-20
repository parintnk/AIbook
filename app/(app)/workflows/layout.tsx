"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Constrains the workflows workspace (list / new / view) to the app's 1180px content
 * column — EXCEPT the full-screen canvases: the draft editor (`/workflows/{id}/edit`)
 * and the lineage graph (`/workflows/{id}/lineage`), which go full-bleed so the canvas
 * fills the viewport below the nav. Those own their own height; every other surface
 * keeps the centred column.
 */
export default function WorkflowsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFullBleed = /\/workflows\/[^/]+\/(edit|lineage)$/.test(pathname);

  if (isFullBleed) return <>{children}</>;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-8">{children}</div>
  );
}
