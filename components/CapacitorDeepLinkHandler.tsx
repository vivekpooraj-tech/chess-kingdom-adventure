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
 * A no-op on web — appUrlOpen only ever fires on native platforms, and
 * isNativePlatform() short-circuits before anything Capacitor-specific
 * loads.
 */
export function CapacitorDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appUrlOpen", async (data) => {
        const url = new URL(data.url);
        const code = url.searchParams.get("code");
        if (!code) {
          router.push("/sign-in?error=auth_failed");
          return;
        }
        const supabase = createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        router.push(error ? "/sign-in?error=auth_failed" : "/parent-gate");
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
