"use client";

import { useState } from "react";
import Link from "next/link";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/branding/Logo";
import { TEXT } from "@/lib/designSystem";

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
 * Step 1 of password recovery. Sends a Supabase reset email whose link comes
 * back through /auth/callback?next=/reset-password (server-side PKCE
 * exchange), landing the user on /reset-password to choose a new password.
 *
 * The success message is deliberately identical whether or not the email is
 * registered — resetPasswordForEmail() itself never discloses that, and we
 * don't either.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);

    if (error) {
      if (isAuthRetryableFetchError(error)) {
        setError("Couldn't reach the server. Check your connection and try again.");
        return;
      }
      if (error.code === "over_email_send_rate_limit" || (error.status ?? 0) === 429) {
        setError("Too many requests. Please wait a minute, then try again.");
        return;
      }
      // Any other error is not disclosed (could hint at account existence).
    }
    setSent(true);
  }

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-7">
          <Logo variant="compact" size={56} />
          <h1 className={`${TEXT.heading} text-center`}>Reset your password</h1>
          <p className={`${TEXT.body} text-center max-w-xs`}>
            {sent
              ? "Check your inbox for the reset link."
              : "Enter your email and we'll send you a link to set a new password."}
          </p>
        </div>

        <div className="rounded-premiumCard bg-premium-navy/80 border border-premium-ivory/[0.08] shadow-premiumCard p-6 sm:p-7">
          {sent ? (
            <div className="flex flex-col gap-5 text-center">
              <p
                role="status"
                className="rounded-premiumBtn bg-emerald-500/10 border border-emerald-400/25 px-3.5 py-3 font-classic-body text-sm text-emerald-300"
              >
                If an account exists for <span className="font-semibold">{email}</span>, a password
                reset link is on its way. Check your inbox — and your spam folder.
              </p>
              <Link href="/sign-in">
                <Button tone="premium" size="md" variant="secondary" className="w-full">
                  Back to sign in
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setError(null);
                }}
                className={LINK}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form className="flex flex-col gap-5" onSubmit={submit}>
              {error && (
                <p
                  role="alert"
                  className="rounded-premiumBtn bg-red-500/10 border border-red-400/25 px-3.5 py-2.5 font-classic-body text-sm text-red-300"
                >
                  {error}
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
                  autoFocus
                  className={FIELD}
                />
              </div>

              <Button
                tone="premium"
                size="md"
                type="submit"
                disabled={loading || !email}
                className="w-full"
              >
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
        </div>

        <p className={`${TEXT.body} text-center mt-6`}>
          Remember your password?{" "}
          <Link href="/sign-in" className={LINK}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
