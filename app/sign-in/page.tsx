"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Logo } from "@/components/branding/Logo";
import { TEXT } from "@/lib/designSystem";

type Mode = "signin" | "signup";

const FIELD =
  "w-full rounded-premiumBtn bg-premium-midnightDeep/50 border border-premium-ivory/15 px-4 py-3 " +
  "font-classic-body text-[15px] text-premium-ivory placeholder:text-premium-ivory/25 transition-colors " +
  "focus:outline-none focus:border-premium-gold/60 focus:ring-2 focus:ring-premium-gold/20";
// Autofill background masking is handled globally in app/globals.css
// (`.bg-premium-midnight input:-webkit-autofill …`) so it survives focus/hover.

const LABEL = "font-classic-body text-[13px] font-medium text-premium-ivory/75";
const LINK =
  "font-classic-body text-sm text-premium-gold hover:text-premium-gold/80 underline-offset-4 hover:underline " +
  "rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/50";

/**
 * Chess Mind sign-in. Two methods:
 *  - Email + password (Supabase Email provider, password auth).
 *  - Google (Supabase Google provider). On web it's a normal full-page OAuth
 *    redirect back to /auth/callback. On Android the app's WebView can't run
 *    Google's OAuth screen (Google blocks embedded WebViews), so we open the
 *    system browser via @capacitor/browser with redirectTo:
 *    chesskingdom://auth/callback; Android routes that back to the app where
 *    CapacitorDeepLinkHandler finishes the exchange in this same WebView
 *    (where the matching PKCE verifier lives).
 *
 * "Forgot password?" -> /forgot-password -> reset email -> /reset-password.
 */
export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next?.startsWith("/")) setNextPath(next);

    if (params.get("error") === "auth_failed") {
      setError("Sign-in couldn't be completed. Please try again.");
      window.history.replaceState({}, "", "/sign-in");
    }
    const devSeedError = params.get("devSeedError");
    if (devSeedError) {
      setError(decodeURIComponent(devSeedError));
      window.history.replaceState({}, "", "/sign-in");
    }
  }, []);

  const busy = loading || googleLoading;
  const isSignup = mode === "signup";

  async function submit() {
    if (busy) return;
    setLoading(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();
    const destination = nextPath ? `/parent-gate?next=${encodeURIComponent(nextPath)}` : "/parent-gate";

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        if (error.code === "email_not_confirmed") {
          setError("Please confirm your email first — check your inbox for the confirmation link.");
          return;
        }
        if (isAuthRetryableFetchError(error)) {
          setError("Couldn't reach the server. Check your connection and try again.");
          return;
        }
        // invalid_credentials / unknown user / wrong password — one generic
        // message, never revealing which part was wrong.
        setError("Incorrect email or password. Please try again.");
        return;
      }
      router.push(destination);
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      if (error.code === "user_already_exists" || error.code === "email_exists") {
        setError("That email is already registered. Try signing in instead.");
        return;
      }
      if (isAuthRetryableFetchError(error) || ((error as { status?: number }).status ?? 0) >= 500) {
        setError(
          "We couldn't finish creating your account. Please try again in a moment, or continue with Google."
        );
        return;
      }
      setError("We couldn't create that account. Please check your details and try again.");
      return;
    }

    if (data.session) {
      router.push(destination);
      return;
    }
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      // Supabase returns a user with no identities when the email is already
      // registered — surface it the same way as an explicit "exists" error.
      setError("That email is already registered. Try signing in instead.");
      return;
    }
    setInfo("Account created — check your email for a confirmation link, then sign in.");
    setMode("signin");
  }

  async function signInWithGoogle() {
    if (busy) return;
    setGoogleLoading(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();
    const isNative = Capacitor.isNativePlatform();
    const redirectTo = isNative
      ? "chesskingdom://auth/callback"
      : `${window.location.origin}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: isNative,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error || (isNative && !data?.url)) {
      setGoogleLoading(false);
      setError("Couldn't start Google sign-in. Please try again.");
      return;
    }

    if (isNative && data?.url) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: data.url });
      // Leave googleLoading on: the app is now backgrounded in the system
      // browser. CapacitorDeepLinkHandler takes over when the deep link
      // returns and navigates away from this page.
      return;
    }
    // Web: the SDK is doing a full-page redirect to Google right now.
  }

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-7">
          <Logo variant="compact" size={56} />
          <h1 className={`${TEXT.heading} text-center`}>
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className={`${TEXT.body} text-center max-w-xs`}>
            {isSignup
              ? "Start your Chess Mind journey."
              : "Sign in to continue your Chess Mind journey."}
          </p>
        </div>

        <div className="rounded-premiumCard bg-premium-navy/80 border border-premium-ivory/[0.08] shadow-premiumCard p-6 sm:p-7">
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {error && (
              <p
                role="alert"
                className="rounded-premiumBtn bg-red-500/10 border border-red-400/25 px-3.5 py-2.5 font-classic-body text-sm text-red-300"
              >
                {error}
              </p>
            )}
            {info && (
              <p
                role="status"
                className="rounded-premiumBtn bg-emerald-500/10 border border-emerald-400/25 px-3.5 py-2.5 font-classic-body text-sm text-emerald-300"
              >
                {info}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className={LABEL}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                aria-invalid={!!error}
                className={FIELD}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className={LABEL}>
                Password
              </label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? "Create a password" : "Your password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={isSignup ? 8 : undefined}
                aria-invalid={!!error}
              />
              {!isSignup && (
                <div className="flex justify-end pt-0.5">
                  <Link href="/forgot-password" className={LINK}>
                    Forgot password?
                  </Link>
                </div>
              )}
            </div>

            <Button
              tone="premium"
              size="md"
              type="submit"
              disabled={busy || !email || password.length < (isSignup ? 8 : 6)}
              className="w-full"
            >
              {loading
                ? isSignup
                  ? "Creating account…"
                  : "Signing in…"
                : isSignup
                  ? "Create account"
                  : "Sign in"}
            </Button>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-premium-ivory/10" />
              <span className={TEXT.caption}>or</span>
              <span className="h-px flex-1 bg-premium-ivory/10" />
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 rounded-premiumBtn bg-premium-ivory px-4 py-3 font-classic-body text-[15px] font-medium text-premium-midnightDeep hover:brightness-95 active:brightness-90 transition-[filter] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-premium-navy"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
              </svg>
              {googleLoading ? "Opening Google…" : "Continue with Google"}
            </button>
          </form>
        </div>

        <p className={`${TEXT.body} text-center mt-6`}>
          {isSignup ? "Already have an account? " : "New to Chess Mind? "}
          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? "signin" : "signup");
              setError(null);
              setInfo(null);
            }}
            className={LINK}
          >
            {isSignup ? "Sign in" : "Create account"}
          </button>
        </p>
      </div>
    </main>
  );
}
