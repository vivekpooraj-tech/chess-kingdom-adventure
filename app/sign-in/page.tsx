"use client";

import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Email magic-link only for this slice. Google/Apple OAuth are wired the
 * same way (supabase.auth.signInWithOAuth({ provider: 'google' | 'apple' }))
 * but need a registered OAuth app + redirect URLs configured in the Supabase
 * dashboard first — that's an account-setup task, not a code task, so it's
 * left as a documented next step in the README rather than half-wired here.
 */
export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendMagicLink() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    // Inside the wrapped Android app, the https callback URL can't reach
    // us directly — see CapacitorDeepLinkHandler for why a custom scheme
    // is needed instead. Web sign-in is unaffected.
    const redirectTo = Capacitor.isNativePlatform()
      ? "chesskingdom://auth/callback"
      : `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });
    setLoading(false);
    if (error) {
      // error.message isn't always a usable string — some Supabase error
      // shapes (e.g. a raw 500 from the mail sender) don't populate it the
      // way supabase-js expects. Confirmed in testing: it comes back as
      // the literal 2-character string "{}" for this specific failure, not
      // empty/undefined — a plain truthy check let it straight through, so
      // this checks for actual letters instead of just non-emptiness.
      const rawMessage = error.message?.trim();
      const isUsableMessage = rawMessage && /[a-zA-Z]/.test(rawMessage);
      setError(
        isUsableMessage
          ? rawMessage
          : "Something went wrong sending that email — please try again in a moment."
      );
    } else {
      setSent(true);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
      <Card className="max-w-sm w-full flex flex-col items-center gap-5 text-center">
        <span className="text-5xl">🔑</span>
        <h1 className="font-display text-2xl text-kingdom-night">Parent Sign-In</h1>
        <p className="font-body text-kingdom-night/70 text-sm">
          We'll email you a magic link — no password to remember.
        </p>

        {sent ? (
          <p className="font-body text-kingdom-forest">
            Check your inbox! Tap the link we sent to {email}.
          </p>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-btn px-4 py-3 border-2 border-kingdom-night/10 font-body text-lg"
            />
            {error && <p className="font-body text-sm text-kingdom-coral">{error}</p>}
            <Button size="md" onClick={sendMagicLink} disabled={!email || loading}>
              {loading ? "Sending..." : "Send Magic Link"}
            </Button>
          </>
        )}
      </Card>
    </main>
  );
}
