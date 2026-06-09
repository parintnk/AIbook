import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Refreshes the Supabase auth session cookie on every request.
 * Env-gated: with no Supabase config the request passes through untouched.
 *
 * CRITICAL: do not run any logic between `createServerClient` and
 * `supabase.auth.getUser()`, or sessions may be dropped at random.
 * No redirect/authorization logic here yet — that arrives in Story 1.3.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch {
    // Supabase unreachable or token error: don't 500 every matched route — the
    // session just isn't refreshed this request. (Sentry captures the throw via
    // instrumentation.) No redirect logic here (Story 1.3).
  }

  return supabaseResponse;
}
