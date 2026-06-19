import type { ReactNode } from "react";

/** Constrains the workflows workspace (list / new / edit / view) to the app's
 *  1180px content column (matches explore / search / community + the detail mockup). */
export default function WorkflowsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-8">{children}</div>
  );
}
