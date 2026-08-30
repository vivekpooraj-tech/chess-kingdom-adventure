"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Logo } from "@/components/branding/Logo";
import { TEXT } from "@/lib/designSystem";

const LABEL = "font-classic-body text-[13px] font-medium text-premium-ivory/75";
const LINK =
  "font-classic-body text-sm text-premium-gold hover:text-premium-gold/80 underline-offset-4 hover:underline " +
  "rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/50";

const MIN_LENGTH = 8;

type Stage = "verifying" | "form" | "invalid" | "success";

/**
 * Step 2 of password recovery. Reached either:
 *  - via /auth/callback?next=/reset-password, which already exchanged the
 *    recovery code server-side, so a session exists on arrival; or
 *  - directly with ?token_hash=…&type=recovery (if the Supabase "Reset
 *    Password" email template is switched to the token-hash form for
 *    cross-device links), which we verify here with verifyOtp().
 *
 * Either way we end up with a recovery session and call updateUser() to set
 * the new password, then continue to the dashboard.
 */
function ResetPasswordInner() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("verifying");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const params = new URLSearchParams(window.location.search);

      if (params.get("error") || params.get("error_code") || params.get("error_description")) {
        if (!cancelled) setStage("invalid");
        return;
      }

      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      if (tokenHash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        window.history.replaceState({}, "", "/reset-password");
        if (!cancelled) setStage(error ? "invalid" : "form");
        return;
      }

      // Arrived via /auth/callback?next=/reset-password — the recovery code
      // was already exchanged server-side; a session cookie should be set.
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setStage(data.session ? "form" : "invalid");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (newPassword.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirm) {
      setError("Those passwords don't match.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);

    if (error) {
      if (isAuthRetryableFetchError(error)) {
        setError("Couldn't reach the server. Check your connection and try again.");
        return;
      }
      if (error.code === "same_password") {
        setError("That's the same as your current password — choose a new one.");
        return;
      }
      if (error.code === "weak_password") {
        setError(error.message || "Please choose a stronger password.");
        return;
      }
      if (error.code === "session_not_found" || (error.status ?? 0) === 401) {
        setStage("invalid");
        return;
      }
      setError("We couldn't update your password. Please request a new reset link.");
      return;
    }

    setStage("success");
    setTimeout(() => {
      router.replace("/parent-gate");
    }, 1600);
  }

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-7">
          <Logo variant="compact" size={56} />
          <h1 className={`${TEXT.heading} text-center`}>
            {stage === "success"
              ? "Password updated"
              : stage === "form"
                ? "Set a new password"
                : "Password reset"}
          </h1>
          {stage === "form" && (
            <p className={`${TEXT.body} text-center max-w-xs`}>
              Choose a new password for your Chess Mind account.
            </p>
          )}
        </div>

        <div className="rounded-premiumCard bg-premium-navy/80 border border-premium-ivory/[0.08] shadow-premiumCard p-6 sm:p-7">
          {stage === "verifying" && (
            <p className={`${TEXT.body} text-center py-4`}>Checking your reset link…</p>
          )}

          {stage === "invalid" && (
            <div className="flex flex-col gap-5 text-center">
              <p
                role="alert"
                className="rounded-premiumBtn bg-red-500/10 border border-red-400/25 px-3.5 py-3 font-classic-body text-sm text-red-300"
              >
                This reset link is invalid or has expired. Reset links can only be used once and time
                out after a while.
              </p>
              <Link href="/forgot-password">
                <Button tone="premium" size="md" className="w-full">
                  Request a new link
                </Button>
              </Link>
              <Link href="/sign-in" className={LINK}>
                Back to sign in
              </Link>
            </div>
          )}

          {stage === "form" && (
            <form className="flex flex-col gap-5" onSubmit={updatePassword}>
              {error && (
                <p
                  role="alert"
                  className="rounded-premiumBtn bg-red-500/10 border border-red-400/25 px-3.5 py-2.5 font-classic-body text-sm text-red-300"
                >
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-password" className={LABEL}>
                  New password
                </label>
                <PasswordInput
                  id="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  minLength={MIN_LENGTH}
                  required
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm-password" className={LABEL}>
                  Confirm new password
                </label>
                <PasswordInput
                  id="confirm-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  minLength={MIN_LENGTH}
                  required
                />
              </div>

              <Button
                tone="premium"
                size="md"
                type="submit"
                disabled={submitting || !newPassword || !confirm}
                className="w-full"
              >
                {submitting ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}

          {stage === "success" && (
            <div className="flex flex-col gap-5 text-center">
              <p
                role="status"
                className="rounded-premiumBtn bg-emerald-500/10 border border-emerald-400/25 px-3.5 py-3 font-classic-body text-sm text-emerald-300"
              >
                Your password has been updated. Taking you to your dashboard…
              </p>
              <Link href="/parent-gate">
                <Button tone="premium" size="md" className="w-full">
                  Continue
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-premium-midnight" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
