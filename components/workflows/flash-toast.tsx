"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Shows a one-shot success toast set in sessionStorage by a server-action that
 * redirects here (e.g. publishing a draft — Story 2.5). Reads + clears the flag
 * on mount, so the toast survives the navigation the action triggers.
 */
export function FlashToast() {
  useEffect(() => {
    const msg = sessionStorage.getItem("workflow-flash");
    if (msg) {
      sessionStorage.removeItem("workflow-flash");
      toast.success(msg);
    }
  }, []);
  return null;
}
