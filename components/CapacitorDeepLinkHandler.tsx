"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";

/**
 * Completes magic-link sign-in when the app is opened via the
 * chesskingdom:// custom scheme instead of a normal https URL — see the
 * comment on that intent-filter in AndroidManifest.xml for why the
 * standard Android App Links approach can't handle this flow (Supabase's
 * own domain is the first hop, not ours, so Android never gets to route
 * the first tap to this app). This component receives the redirect
 * directly as a native event and finishes the sign-in itself, mirroring
 * what app/auth/callback/route.ts does for the web flow.
 *
 * Two delivery paths, both handled here — a real device test surfaced that
 * only one was wired up:
 *  - `appUrlOpen` fires when the app is already running (native's
 *    `handleOnNewIntent`) — the app was backgrounded, user taps the email
 *    link, Android routes it straight back in.
 *  - `App.getLaunchUrl()` covers the app being launched FRESH by the tap
 *    (not already running) — the far more common real case, since nobody
 *    usually leaves a chess app open in the background while checking
 *    email. `appUrlOpen` never fires for this; Capacitor delivers a cold
 *    launch's URL only through getLaunchUrl(). Without this, tapping a
 *    magic link with the app not already running silently did nothing —
 *    the app would just open to its normal (signed-out) start screen,
 *    which looks exactly like "the sign-in link didn't work."
 *
 * A no-op on web — neither path exists there, and isNativePlatform()
 * short-circuits before anything Capacitor-specific loads.
 */
export function CapacitorDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | undefined;
    let cancelled = false;

    async function handleUrl(rawUrl: string) {
      const url = new URL(rawUrl);
      const code = url.searchParams.get("code");
      if (!code) {
        router.push("/sign-in?error=auth_failed");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      router.push(error ? "/sign-in?error=auth_failed" : "/parent-gate");
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
