"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Mode = "signin" | "signup";

function formatAuthError(message: string | undefined, fallback: string) {
  const rawMessage = message?.trim();
  const isUsableMessage = rawMessage && /[a-zA-Z]/.test(rawMessage);
  return isUsableMessage ? rawMessage : fallback;
}

/**
 * Email + password sign-in for parents. Supabase must have the Email provider
 * enabled with password auth in the project dashboard (not magic link only).
 */
export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next?.startsWith("/")) {
      setNextPath(next);
    }

    if (params.get("error") === "auth_failed") {
      setError("Sign-in failed — please try again.");
      window.history.replaceState({}, "", "/sign-in");
    }

    const devSeedError = params.get("devSeedError");
    if (devSeedError) {
      setError(decodeURIComponent(devSeedError));
      window.history.replaceState({}, "", "/sign-in");
    }
  }, []);

  async function submit() {
    setLoading(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();
    const destination = nextPath ? `/parent-gate?next=${encodeURIComponent(nextPath)}` : "/parent-gate";

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);

      if (error) {
        setError(formatAuthError(error.message, "Invalid email or password — please try again."));
        return;
      }

      router.push(destination);
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      setError(formatAuthError(error.message, "Could not create that account — please try again."));
      return;
    }

    if (data.session) {
      router.push(destination);
      return;
    }

    setInfo("Account created. If email confirmation is enabled in Supabase, check your inbox, then sign in here.");
    setMode("signin");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
      <Card className="max-w-sm w-full flex flex-col items-center gap-5 text-center">
        <span className="text-5xl">🔑</span>
        <h1 className="font-display text-2xl text-kingdom-night">Parent Sign-In</h1>
        <p className="font-body text-kingdom-night/70 text-sm">
          {mode === "signin"
            ? "Sign in with your email and password."
            : "Create a parent account with email and password."}
        </p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          aria-label="Email address"
          className="w-full rounded-btn px-4 py-3 border-2 border-kingdom-night/10 font-body text-lg"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          aria-label="Password"
          className="w-full rounded-btn px-4 py-3 border-2 border-kingdom-night/10 font-body text-lg"
        />

        {error && <p className="font-body text-sm text-kingdom-coral">{error}</p>}
        {info && <p className="font-body text-sm text-kingdom-forest">{info}</p>}

        <Button
          size="md"
          onClick={submit}
          disabled={!email || password.length < 6 || loading}
        >
          {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setInfo(null);
          }}
          className="font-body text-sm text-kingdom-royal underline underline-offset-2"
        >
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </Card>
    </main>
  );
}
