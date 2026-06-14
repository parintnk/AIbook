import type { ReactNode } from "react";

/** Constrains the workflows workspace (list / new / edit) to a centered column. */
export default function WorkflowsLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-6 py-8">{children}</div>;
}
