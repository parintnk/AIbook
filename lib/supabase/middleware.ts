import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "./database.types";

/**
 * Route prefixes that require an authenticated user. Browse routes stay PUBLIC
 * (RLS posture) — only account-scoped and authoring routes are gated here.
 */
const PROTECTED_PREFIXES = [
  "/account",
  "/admin",
  "/settings",
  "/workflows/new",
  "/forked",
  "/boards",
  "/me",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Refreshes the Supabase auth session cookie on every request, then redirects
 * unauthenticated requests to protected routes toward `/sign-in?next=…`.
 * Env-gated: with no Supabase config the request passes through untouched.
 *
 * CRITICAL: do not run any logic between `createServerClient` and
 * `supabase.auth.getUser()`, or sessions may be dropped at random. Auth routes
 * (`/sign-in`, `/sign-up`, `/auth/*`) are never protected, so the callback
 * route and the auth pages are always reachable.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient<Database>(url, key, {
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

  // Nothing between createServerClient and getUser(). Capture the user so we can
  // gate protected routes below.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unreachable or token error: don't 500 every matched route — the
    // session just isn't refreshed this request (Sentry captures the throw via
    // instrumentation). Treat as unauthenticated for routing purposes.
  }

  if (!user && isProtected(request.nextUrl.pathname)) {
    // Preserve the full intended destination (path + query) so the user lands
    // back where they meant to after signing in.
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
