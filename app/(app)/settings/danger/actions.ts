"use server";

import { deleteMyAccount } from "@/lib/services/profiles";

/**
 * Permanently delete the caller's account (account lifecycle). Runs the cascade-deleting RPC; the
 * client signs out + navigates home on success (the session is invalid once the auth row is gone).
 */
export async function deleteAccountAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const res = await deleteMyAccount();
  if (res.ok) return { ok: true };
  if (res.error === "not_authenticated")
    return { ok: false, error: "You're not signed in." };
  return {
    ok: false,
    error: "Couldn't delete your account. Please try again.",
  };
}
