import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes a child/parent can reach without an active session. The Stripe
// webhook is here too — Stripe calls it server-to-server with no session
// cookie at all, and it authenticates the request itself via signature
// verification (see app/api/stripe/webhook/route.ts), not via user auth.
const PUBLIC_PATHS = ["/", "/sign-in", "/auth/callback", "/api/stripe/webhook"];

export async function middleware(request: NextRequest) {
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

  if (!user && !isPublic) {
    const redirectUrl = new URL("/sign-in", request.url);
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  // Skip static assets and Next internals; run on everything else so the
  // session cookie stays fresh across the whole app.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
