import { createServerClient } from "@supabase/ssr";
import { BRAND } from "@/lib/brand";
import { NextRequest, NextResponse } from "next/server";

const ANDROID_PACKAGE_ID = "com.chesskingdom.adventure";

/**
 * Android's Chrome/WebView engine resolves `intent://` URIs itself (via
 * Intent.parseUri, at the browser-engine level) even inside constrained
 * in-app browsers — Gmail's, Slack's, etc. A bare `chesskingdom://` href
 * doesn't have that guarantee: several in-app browsers refuse to hand off
 * to an external app for an unrecognized scheme even on a direct tap,
 * which is what a bare-scheme fallback link was silently hitting here.
 * `S.browser_fallback_url` also gives Chrome something real to fall back
 * to if the app isn't installed, instead of doing nothing.
 */
function androidIntentUrl(code: string, fallbackUrl: string) {
  return `intent://auth/callback?code=${encodeURIComponent(code)}#Intent;scheme=chesskingdom;package=${ANDROID_PACKAGE_ID};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
}

function customSchemeUrl(code: string) {
  return `chesskingdom://auth/callback?code=${encodeURIComponent(code)}`;
}

function openingAppPage(deepLink: string, fallbackUrl: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Opening ${BRAND.name}…</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:20px;text-align:center;padding:24px;margin:0;background:#0F1629;color:#F7F3E8;">
  <p style="font-size:18px;">Opening the ${BRAND.name} app…</p>
  <a href="${deepLink}" style="display:inline-block;padding:14px 28px;border-radius:10px;background:#D4AF37;color:#080C18;font-weight:700;text-decoration:none;font-size:16px;">Open ${BRAND.name}</a>
  <a href="${fallbackUrl}" style="font-size:14px;color:#F7F3E8;opacity:0.65;text-decoration:underline;">Continue in browser</a>
  <script>window.location.href = ${JSON.stringify(deepLink)};</script>
</body>
</html>`;
}

function messagePage(message: string, fallbackUrl: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${BRAND.name}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;text-align:center;padding:24px;margin:0;background:#0F1629;color:#F7F3E8;">
  <p style="font-size:16px;max-width:320px;">${message}</p>
  <a href="${fallbackUrl}" style="display:inline-block;padding:14px 28px;border-radius:10px;background:#D4AF37;color:#080C18;font-weight:700;text-decoration:none;font-size:16px;">Back to Sign In</a>
</body>
</html>`;
}

/**
 * OAuth / PKCE callback.
 *
 *  - Web (Google, and any future provider): the browser lands here with
 *    `?code=`. We exchange it for a session server-side and persist the
 *    session cookies ON THIS redirect response (see the bound cookie
 *    handlers below — `cookies().set()` from a route handler is not
 *    reliably attached to a NextResponse you build yourself, which is the
 *    classic "logged in but the session vanishes on the next request" bug).
 *
 *  - Native Android: sign-in requests `redirectTo: chesskingdom://auth/callback`
 *    directly (see app/sign-in/page.tsx), so the OS routes the result to the
 *    app and CapacitorDeepLinkHandler finishes the exchange in the WebView
 *    that started it. This route's `?platform=native` branch below is only a
 *    defensive fallback for a redirect that somehow arrives on https instead.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error");
  const isNative = requestUrl.searchParams.get("platform") === "native";
  const signInUrl = new URL("/sign-in", requestUrl.origin).toString();

  // Where to land after a successful exchange. Strict allowlist pattern — a
  // leading "/" then only path-safe characters. This blocks every open-
  // redirect vector: protocol-relative ("//host"), full URLs ("https://…"),
  // the backslash trick ("/\host" — the WHATWG URL parser rewrites "\" to
  // "/" for http(s), turning it into a network-path reference), embedded
  // control chars, "@", "..", and query strings. Anything else falls back to
  // the parent gate (the normal post-sign-in destination). The password-
  // reset flow passes `?next=/reset-password`; a failed exchange for that
  // flow returns to the reset page (so it can show "link expired") rather
  // than the sign-in error state.
  const nextParam = requestUrl.searchParams.get("next");
  const safeNext =
    nextParam && /^\/[A-Za-z0-9\-_/]+$/.test(nextParam) ? nextParam : "/parent-gate";
  const isRecovery = safeNext === "/reset-password";
  const failureUrl = isRecovery ? "/reset-password?error=expired" : "/sign-in?error=auth_failed";

  if (oauthError) {
    // Provider denied / user cancelled / misconfig — never proceed as if
    // signed in.
    return NextResponse.redirect(new URL(failureUrl, request.url));
  }

  if (isNative) {
    if (!code) {
      return new NextResponse(
        messagePage(
          "That sign-in link is missing its code — it may have already been used. Please try again.",
          signInUrl
        ),
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    // The PKCE verifier lives in the app WebView's storage, not this
    // browser's, so the exchange has to happen back in the app.
    const userAgent = request.headers.get("user-agent") ?? "";
    const deepLink = /Android/i.test(userAgent)
      ? androidIntentUrl(code, signInUrl)
      : customSchemeUrl(code);
    return new NextResponse(openingAppPage(deepLink, signInUrl), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (code) {
    const response = NextResponse.redirect(new URL(safeNext, request.url));
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.log("[auth] OAuth callback completed: exchange failed");
      return NextResponse.redirect(new URL(failureUrl, request.url));
    }
    console.log("[auth] OAuth callback completed: session established");
    return response;
  }

  // No code and no error — nothing to do here; send them on to `next`
  // (defaults to the gate), which bounces to /sign-in if there's genuinely
  // no session.
  return NextResponse.redirect(new URL(safeNext, request.url));
}
