"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, getAuthState } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient, setActiveChildIdClient } from "@/lib/childSession";
import { Button } from "@/components/ui/Button";
import { LOCAL_TEST_MODE } from "@/lib/devTestMode";
import { TEXT } from "@/lib/designSystem";

/**
 * Per docs/04-user-flows.md: a lightweight "is an adult here" check before
 * any setup screen — not real security, just enough friction that a young
 * child can't stumble through account setup on their own. Also reused to
 * gate entry to the parent dashboard via ?next=/parent-dashboard.
 *
 * LOCAL_TEST_MODE (lib/devTestMode.ts) skips only this arithmetic-challenge
 * friction step, not Supabase auth itself — proceedPastGate() below still
 * requires a real authenticated session and does the exact same child
 * resolution as a normal solved-challenge submit.
 */
function randomChallenge() {
  const a = 3 + Math.floor(Math.random() * 6);
  const b = 3 + Math.floor(Math.random() * 6);
  return { a, b, answer: a + b };
}

export default function ParentGatePage() {
  // useSearchParams() requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <ParentGateInner />
    </Suspense>
  );
}

function ParentGateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [challenge, setChallenge] = useState(randomChallenge);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setChallenge(randomChallenge());
  }, []);

  useEffect(() => {
    if (LOCAL_TEST_MODE) proceedPastGate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The real post-challenge logic — unchanged from before, just pulled out
  // so the dev bypass above can reuse it exactly instead of faking its own
  // version of "what happens after the gate."
  async function proceedPastGate() {
    setChecking(true);
    setError(null);
    const supabase = createClient();
    const authState = await getAuthState(supabase);

    if (authState.status === "network-error") {
      // Valid session that just couldn't be confirmed offline — never
      // treat this as "signed out". Let them retry.
      setChecking(false);
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    }
    if (authState.status === "unauthenticated") {
      router.push("/sign-in");
      return;
    }
    const user = authState.user;

    // If we were sent here to reach a specific destination (e.g. the parent
    // dashboard), go straight there once the check passes.
    if (next) {
      router.push(next);
      return;
    }

    try {
      const resolution = await resolveActiveChild(
        supabase,
        user.id,
        getActiveChildIdClient()
      );
      setChecking(false);

      if (resolution.needsSelection) {
        router.push("/choose-child");
        return;
      }

      const child = resolution.child!;
      setActiveChildIdClient(child.id);
      if (!child.experience_level) {
        router.push("/onboarding/experience");
      } else if (child.avatar_id && child.buddy_id) {
        router.push("/kingdom-map");
      } else {
        router.push("/onboarding/avatar");
      }
    } catch {
      // Child-profile resolution failed even after its own retry — a valid
      // parent session must never be left stuck on "Checking…". Let them retry.
      setChecking(false);
      setError("Couldn't load your profile. Check your connection and try again.");
    }
  }

  async function handleSubmit() {
    if (Number(input) !== challenge.answer) {
      setError("Not quite — try the new question below.");
      setChallenge(randomChallenge());
      setInput("");
      return;
    }
    await proceedPastGate();
  }

  if (LOCAL_TEST_MODE) {
    return <main className="min-h-screen" />;
  }

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-6 px-6">
      <div className="max-w-sm w-full flex flex-col items-center gap-5 text-center rounded-card border border-premium-gold/15 bg-premium-navy/40 px-6 py-8 shadow-premiumCard">
        <h1 className={`${TEXT.heading} text-premium-ivory`}>
          One quick check for a grown-up
        </h1>
        <p className={`${TEXT.body} text-premium-ivory/70`}>
          Please solve this to continue setup.
        </p>
        <p className="font-classic-display text-2xl text-premium-ivory">
          {challenge.a} + {challenge.b} = ?
        </p>
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          aria-label={`What is ${challenge.a} + ${challenge.b}?`}
          className="w-32 text-center rounded-premiumBtn px-4 py-3 border border-premium-ivory/15 bg-premium-midnightDeep/50 font-classic-body text-xl text-premium-ivory focus:outline-none focus:border-premium-gold/60 focus:ring-2 focus:ring-premium-gold/20"
        />
        {error && <p className="font-classic-body text-sm text-semantic-retry">{error}</p>}
        <Button tone="premium" size="md" onClick={handleSubmit} disabled={!input || checking}>
          {checking ? "Checking..." : "Continue"}
        </Button>
      </div>
    </main>
  );
}


