import { createClient } from "@/lib/supabase/server";
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

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const isNative = requestUrl.searchParams.get("platform") === "native";
  const signInUrl = new URL("/sign-in", requestUrl.origin).toString();

  if (isNative) {
    if (!code) {
      return new NextResponse(
        messagePage(
          "That sign-in link is missing its code — it may have already been used. Please request a new one.",
          signInUrl
        ),
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Reached in an external (or in-app, e.g. Gmail's) browser, not the
    // app's own WebView — the PKCE code's matching verifier lives in the
    // app's local storage, not this browser's, so the exchange has to
    // happen back in the app, not here (see CapacitorDeepLinkHandler).
    // "Continue in browser" deliberately goes back to /sign-in rather than
    // trying to consume this code here — this browser has no matching
    // verifier, so exchanging it here would just fail.
    const userAgent = request.headers.get("user-agent") ?? "";
    const deepLink = /Android/i.test(userAgent)
      ? androidIntentUrl(code, signInUrl)
      : customSchemeUrl(code);

    return new NextResponse(openingAppPage(deepLink, signInUrl), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/sign-in?error=auth_failed", request.url));
    }
  }

  // Parent gate always comes right after auth, before any child-facing
  // screen — see app flow in docs/04-user-flows.md.
  return NextResponse.redirect(new URL("/parent-gate", request.url));
}
