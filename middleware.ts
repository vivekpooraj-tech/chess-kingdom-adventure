import { createServerClient } from "@supabase/ssr";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    // Carry forward any Set-Cookie written during getUser()'s token refresh.
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
