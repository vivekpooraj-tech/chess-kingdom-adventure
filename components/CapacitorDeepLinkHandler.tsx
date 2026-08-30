"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";

// OAuth deep-link idempotency guards. Deliberately module scope — NOT React
// state or a ref — so they survive a component remount / StrictMode
// double-mount, which is exactly when the same deep link gets delivered
// twice (appUrlOpen firing twice, getLaunchUrl + appUrlOpen). Without this,
// a second exchangeCodeForSession() on an already-consumed code fails and
// would bounce a successfully signed-in user to /sign-in?error=auth_failed.
const handledOAuthCodes = new Set<string>();
let oauthExchangeInFlight = false;

/**
 * Finishes Google (OAuth / PKCE) sign-in on native Android. The sign-in
 * screen opens Google in the system browser with
 * `redirectTo: chesskingdom://auth/callback`; Supabase sends the result to
 * that custom scheme, Android's intent-filter (AndroidManifest.xml) hands
 * it to this app, and this component runs `exchangeCodeForSession` in the
 * SAME WebView that started the flow — which is where the matching PKCE
 * verifier lives. Mirrors what app/auth/callback/route.ts does for web.
 *
 * Two delivery paths, both handled:
 *  - `appUrlOpen` fires when the app is already running (the normal case
 *    here: the app is backgrounded behind the system browser, and the
 *    redirect brings it forward).
 *  - `App.getLaunchUrl()` covers a cold start (app was killed while in the
 *    browser). `appUrlOpen` never fires for that; Capacitor only delivers
 *    a cold launch's URL through getLaunchUrl().
 *
 * A no-op on web — isNativePlatform() short-circuits before anything
 * Capacitor-specific loads.
 */
export function CapacitorDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | undefined;
    let cancelled = false;

    async function closeBrowserTab() {
      // The system browser tab opened for Google sign-in (see
      // app/sign-in/page.tsx). Safe no-op if nothing is open or on web.
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.close();
      } catch {
        /* not open / not available */
      }
    }

    async function handleUrl(rawUrl: string) {
      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        return;
      }
      if (url.protocol !== "chesskingdom:") return;
      // eslint-disable-next-line no-console
      console.log("[auth] OAuth callback received (deep link)");
      // Supabase can redirect with ?error=... (user cancelled, provider
      // misconfig) instead of ?code=... — treat both "no code" cases the same.
      const code = url.searchParams.get("code");
      if (!code) {
        await closeBrowserTab();
        router.push("/sign-in?error=auth_failed");
        return;
      }

      // Idempotency: ignore a duplicate delivery of the same code — either
      // one already consumed successfully, or one whose exchange is still
      // running right now.
      if (handledOAuthCodes.has(code) || oauthExchangeInFlight) return;
      oauthExchangeInFlight = true;

      const supabase = createClient();
      let exchangeError: unknown = null;
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        exchangeError = error;
      } catch (thrown) {
        // exchangeCodeForSession can throw (not just return { error }) on a
        // network failure — treat it identically to a returned error so the
        // failure routing and Browser.close() below still run.
        exchangeError = thrown ?? new Error("exchangeCodeForSession threw");
      } finally {
        oauthExchangeInFlight = false;
      }
      // Only lock the code out permanently if it was actually consumed — a
      // genuine mid-exchange network failure stays retryable.
      if (!exchangeError) handledOAuthCodes.add(code);

      await closeBrowserTab();
      // eslint-disable-next-line no-console
      console.log(
        exchangeError
          ? "[auth] OAuth callback completed: failed"
          : "[auth] OAuth callback completed: session established"
      );
      router.push(exchangeError ? "/sign-in?error=auth_failed" : "/parent-gate");
    }

    (async () => {
      const { App } = await import("@capacitor/app");

      // Cold-start case: the app was launched BY this deep-link tap. Only
      // act if the launch URL actually uses our custom scheme — a normal
      // icon tap resolves getLaunchUrl() to undefined (no data URI on a
      // plain LAUNCHER intent), but check explicitly rather than relying
      // on that alone, since a plain https launch URL (App Links) isn't
      // this flow's concern either.
      const launch = await App.getLaunchUrl();
      if (!cancelled && launch?.url?.startsWith("chesskingdom://")) {
        await handleUrl(launch.url);
      }

      // Warm case: the app was already running and received a new intent.
      const handle = await App.addListener("appUrlOpen", (data) => {
        handleUrl(data.url);
      });
      if (cancelled) {
        handle.remove();
      } else {
        removeListener = () => handle.remove();
      }
    })();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [router]);

  return null;
}
