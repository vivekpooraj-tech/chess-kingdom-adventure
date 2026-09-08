"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, getAuthState } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient, setActiveChildIdClient } from "@/lib/childSession";
import { Button } from "@/components/ui/Button";
import { LOCAL_TEST_MODE } from "@/lib/devTestMode";
import { TEXT } from "@/lib/designSystem";
import { postAuthDestination } from "@/lib/auth/postAuthDestination";

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
  // Whether the arithmetic challenge should be shown at all.
  //
  // "deciding" is the initial state whenever we were NOT sent here for a
  // specific `next` destination: the gate first works out where this user
  // actually belongs, and only asks the question if setup lies ahead. An
  // already-onboarded parent is redirected straight to /kingdom-map and never
  // sees a challenge — that unconditional toll booth on every single sign-in
  // was the reported redirect problem.
  //
  // An explicit `next` (the /parent-dashboard link) always challenges: that is
  // the gate's real job, and it must happen every time regardless of setup
  // state, because a child may be holding the device.
  const [phase, setPhase] = useState<"deciding" | "challenge">(
    next ? "challenge" : "deciding"
  );

  useEffect(() => {
    setChallenge(randomChallenge());
  }, []);

  useEffect(() => {
    // LOCAL_TEST_MODE skips the friction outright (deciding=false → navigate).
    // Otherwise the decide step either redirects an already-onboarded user
    // onward, or reveals the challenge because setup lies ahead.
    if (LOCAL_TEST_MODE) void proceedPastGate(false);
    else if (phase === "deciding") void proceedPastGate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Runs in two situations, and the difference is `deciding`:
   *
   *  - deciding=true   before any challenge, to find out whether one is even
   *                    needed. Onboarded users are sent onward here and never
   *                    see the question.
   *  - deciding=false  after the challenge was solved (or LOCAL_TEST_MODE
   *                    skipped it), to carry on to the same destination.
   *
   * Both take the identical path, so there is exactly one place that decides
   * where a signed-in user goes — a second, subtly different copy of these
   * rules is how the gate and /kingdom-map would start bouncing users between
   * each other.
   */
  async function proceedPastGate(deciding = false) {
    setChecking(true);
    setError(null);
    const supabase = createClient();
    const authState = await getAuthState(supabase);

    if (authState.status === "network-error") {
      // Valid session that just couldn't be confirmed offline — never
      // treat this as "signed out". Let them retry.
      setChecking(false);
      // Falling back to the challenge keeps a retry reachable: "deciding" has
      // no button of its own, so staying in it would strand them on a spinner.
      setPhase("challenge");
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    }
    if (authState.status === "unauthenticated") {
      router.push("/sign-in");
      return;
    }
    const user = authState.user;

    // If we were sent here to reach a specific destination (e.g. the parent
    // dashboard), go straight there once the check passes. Never reached while
    // deciding — an explicit `next` starts in the challenge phase.
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

      if (resolution.child) setActiveChildIdClient(resolution.child.id);
      const { href, requiresParentGate } = postAuthDestination(resolution);

      // Setup lies ahead and the adult check has not happened yet — this is
      // the one case the challenge exists for.
      if (deciding && requiresParentGate) {
        setPhase("challenge");
        return;
      }

      router.replace(href);
    } catch {
      // Child-profile resolution failed even after its own retry — a valid
      // parent session must never be left stuck on "Checking…". Let them retry.
      setChecking(false);
      setPhase("challenge");
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

  // Still working out whether a challenge is needed. Render the plain
  // background rather than the question — flashing "6 + 4 = ?" for a moment
  // before redirecting an onboarded parent onward would look exactly like the
  // toll booth this change removes.
  if (phase === "deciding") {
    return <main className="min-h-screen bg-premium-midnight" />;
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


