import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const isNative = requestUrl.searchParams.get("platform") === "native";

  if (isNative) {
    // Reached in an external browser, not the app's own WebView — the
    // PKCE code's matching verifier lives in the app's local storage, not
    // this browser's, so the exchange has to happen back in the app, not
    // here (see CapacitorDeepLinkHandler). A same-page client-side
    // redirect is more reliable than a server 302 straight to a custom
    // scheme (Chrome silently blocked that after this page's own several
    // redirect hops in testing), plus a manual fallback link — a direct
    // tap always gets through even if the automatic redirect doesn't.
    const deepLink = `chesskingdom://auth/callback?code=${encodeURIComponent(code ?? "")}`;
    return new NextResponse(
      `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Opening ${BRAND.name}…</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;text-align:center;padding:24px;margin:0;">
  <p style="font-size:18px;">Opening the Chess Kingdom app…</p>
  <a href="${deepLink}" style="font-size:16px;color:#6D5AE6;">Tap here if it doesn't open automatically</a>
  <script>window.location.href = ${JSON.stringify(deepLink)};</script>
</body>
</html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Parent gate always comes right after auth, before any child-facing
  // screen — see app flow in docs/04-user-flows.md.
  return NextResponse.redirect(new URL("/parent-gate", request.url));
}
