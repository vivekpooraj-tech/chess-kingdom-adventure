import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LOCAL_TEST_MODE, DEV_TEST_USER_EMAIL, DEV_TEST_USER_PASSWORD } from "@/lib/devTestMode";

/**
 * Phase 22 — signs into the real, dedicated dev-only test account (see
 * lib/devTestMode.ts and scripts/dev-seed-test-user.js) so every existing
 * page's own supabase.auth.getUser() call sees a completely normal signed-
 * in session, with zero changes to any of those pages. middleware.ts
 * redirects here instead of to /sign-in when LOCAL_TEST_MODE is on and no
 * session exists yet.
 *
 * Refuses to do anything unless LOCAL_TEST_MODE is true — hard-compiled to
 * false in any production build (see lib/devTestMode.ts), so this route
 * can never actually sign anyone in outside local dev, even if someone
 * knew the URL.
 */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") || "/kingdom-map";

  if (!LOCAL_TEST_MODE) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEV_TEST_USER_EMAIL,
    password: DEV_TEST_USER_PASSWORD,
  });

  if (error) {
    const message = encodeURIComponent(
      "Dev test user not found. Run `node scripts/dev-seed-test-user.js` once, then reload."
    );
    return NextResponse.redirect(new URL(`/sign-in?devSeedError=${message}`, request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
