import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { LOCAL_TEST_MODE } from "@/lib/devTestMode";

// Routes a child/parent can reach without an active session. The Stripe
// webhook is here too — Stripe calls it server-to-server with no session
// cookie at all, and it authenticates the request itself via signature
// verification (see app/api/stripe/webhook/route.ts), not via user auth.
// The dev auto-signin route is here for the same structural reason: it's
// the one route ALLOWED to be reached with no session, because it's the
// thing that establishes one — see app/api/dev/auto-signin/route.ts, which
// refuses to actually sign anyone in unless LOCAL_TEST_MODE is true.
const PUBLIC_PATHS = ["/", "/sign-in", "/auth/callback", "/api/stripe/webhook", "/api/dev/auto-signin"];
const DEV_AUTO_SIGNIN_PATH = "/api/dev/auto-signin";

export async function middleware(request: NextRequest) {
  // Never trust a client-supplied identity header — this gets set for real
  // further down, only after middleware itself has verified the session
  // against Supabase Auth. Stripping it first means a forged header on the
  // incoming request can never survive into a Server Component.
  request.headers.delete("x-user-id");

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // getClaims() (not getUser()) is the load-bearing perf change here. This
  // project signs JWTs with an asymmetric key (confirmed: ES256, not the
  // legacy shared HS256 secret -- see the project's JWT header), so
  // getClaims() verifies the token's signature, issuer, audience, and
  // expiry LOCALLY via WebCrypto against the project's public JWKS
  // (fetched once, cached by the SDK) instead of making a live network
  // call to Supabase's Auth server on every single request. This is
  // Supabase's own documented replacement for getUser() specifically for
  // asymmetric-key projects -- not a bypass or a weaker check: an invalid
  // signature, a tampered payload, or an expired token all still fail
  // verification exactly as before. If the access token is close to
  // expiring, the SDK transparently refreshes the session first (via the
  // same cookie handlers configured above) before validating, so refresh
  // behavior is unchanged. The one real trade-off: a session explicitly
  // revoked server-side (e.g. "sign out everywhere", an admin action)
  // before its own natural expiry won't be caught until that token
  // expires naturally -- bounded by the access token's lifetime (curently
  // ~1 hour), the same bound every JWT-based auth system accepts by
  // design. If the project ever moves back to symmetric (HS256) signing,
  // getClaims() itself falls back to a getUser()-equivalent network call
  // automatically, so this stays correct either way.
  let {
    data,
    error: userError,
  } = await supabase.auth.getClaims();
  let user = data?.claims ? { id: data.claims.sub } : null;

  // Same reasoning as the old getUser() retry: a single transient network
  // failure (JWKS fetch on a cold cache, or a refresh round trip) isn't
  // evidence the session is invalid.
  if (!user && userError && isAuthRetryableFetchError(userError)) {
    ({ data, error: userError } = await supabase.auth.getClaims());
    user = data?.claims ? { id: data.claims.sub } : null;
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) =>
      request.nextUrl.pathname === p ||
      request.nextUrl.pathname.startsWith("/auth/") ||
      // Well-known verification files (e.g. Android App Links'
      // assetlinks.json) are fetched by the OS/other services with no
      // session cookie at all — same reasoning as the Stripe webhook above.
      request.nextUrl.pathname.startsWith("/.well-known/")
  );

  // LOCAL TEST MODE ONLY (Phase 22) — never runs in production; see
  // lib/devTestMode.ts, where LOCAL_TEST_MODE is hard-compiled to `false`
  // for any production build regardless of environment variables. When
  // there's no real session yet, route through the dev-only auto-signin
  // endpoint instead of showing the real sign-in screen, so opening the
  // app locally lands straight in Chess Kingdom. This whole block is
  // skipped entirely whenever LOCAL_TEST_MODE is false, so it changes
  // nothing about production's auth flow.
  if (LOCAL_TEST_MODE && !user && request.nextUrl.pathname !== DEV_AUTO_SIGNIN_PATH) {
    const isEntryPoint = request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/sign-in";
    const nextPath = isEntryPoint ? "/kingdom-map" : request.nextUrl.pathname;
    const autoSigninUrl = new URL(DEV_AUTO_SIGNIN_PATH, request.url);
    autoSigninUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(autoSigninUrl);
  }

  if (!user && !isPublic) {
    // Still couldn't verify after a retry — but a retryable-fetch error
    // means this is an infrastructure hiccup, not evidence the session is
    // invalid. Forcing a sign-in redirect here would throw away a
    // perfectly good refresh token over what's very likely a momentary
    // network blip. Let the request through on whatever cookies already
    // exist; the page's own auth check (or the next request entirely)
    // gets another chance once the network recovers. A genuinely expired
    // or revoked session is still caught the moment verification actually
    // succeeds — this only widens the window before that happens, it
    // never disables the check.
    if (userError && isAuthRetryableFetchError(userError)) {
      return response;
    }
    const redirectUrl = new URL("/sign-in", request.url);
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Every protected Server Component was independently re-calling
  // supabase.auth.getUser() itself, which re-validates the session against
  // Supabase's Auth server over the network AGAIN — a second full round
  // trip on every single tab tap, on top of the one middleware just did.
  // Forwarding the already-verified id via a request header (never a
  // client-settable one — stripped above) lets pages skip that redundant
  // call. See getSessionUser() in lib/supabase/server.ts.
  if (user) {
    const headers = new Headers(request.headers);
    headers.set("x-user-id", user.id);
    const finalResponse = NextResponse.next({ request: { headers } });
    // Carry forward any Set-Cookie written during getClaims()'s token refresh.
    response.cookies.getAll().forEach((cookie) => finalResponse.cookies.set(cookie));
    return finalResponse;
  }

  return response;
}

export const config = {
  // Skip static assets and Next internals; run on everything else so the
  // session cookie stays fresh across the whole app. The `.*\..*` clause
  // excludes any request whose path contains a dot (public/ files like
  // piece SVGs, the Chess Mind logo, app/icon.png, stockfish's .wasm, etc.)
  // — previously only _next/static, _next/image, and favicon.ico were
  // excluded, so every other public/ asset was silently being redirected
  // to /sign-in for signed-out visitors instead of served (caught when the
  // new logo/favicon didn't render on the signed-out splash page).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
