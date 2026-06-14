"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

// Backstop before we stop waiting on the initial session and assume signed-out
// (covers an unreachable Supabase, where the request hangs without settling).
const SESSION_RESOLVE_TIMEOUT_MS = 5000;

/**
 * Exposes the current auth user to client components and keeps it in sync via
 * `onAuthStateChange`, so the UI reacts to sign-in/out without a full reload.
 * Env-gated: with no Supabase config it resolves to a signed-out, non-loading
 * state instead of throwing (keeps the app bootable without env).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    let active = true;

    // Safety net: if the session can't be resolved — e.g. Supabase is
    // unreachable from this device/origin, so `getUser()` neither resolves nor
    // rejects — don't leave the UI stuck on the loading placeholder forever.
    // Fall back to signed-out so the Sign in button still renders.
    const fallback = setTimeout(() => {
      if (active) setLoading(false);
    }, SESSION_RESOLVE_TIMEOUT_MS);

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        // Unreachable auth server → treat as signed-out (handled below).
      })
      .finally(() => {
        if (!active) return;
        clearTimeout(fallback);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      clearTimeout(fallback);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
