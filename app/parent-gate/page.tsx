"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient, setActiveChildIdClient } from "@/lib/childSession";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Per docs/04-user-flows.md: a lightweight "is an adult here" check before
 * any setup screen — not real security, just enough friction that a young
 * child can't stumble through account setup on their own. Also reused to
 * gate entry to the parent dashboard via ?next=/parent-dashboard.
 */
function randomChallenge() {
  const a = 3 + Math.floor(Math.random() * 6);
  const b = 3 + Math.floor(Math.random() * 6);
  return { a, b, answer: a + b };
}

/**
 * TEMPORARY DEV-ONLY TESTING BYPASS — skips only this arithmetic-challenge
 * friction step, not Supabase auth itself (proceedPastGate() below still
 * requires a real authenticated session and does the exact same child
 * resolution as a normal solved-challenge submit). `NODE_ENV` is inlined by
 * Next.js at build time and is always "production" for `next build`/`next
 * start`, so the `&&` short-circuits to `false` and this whole branch is
 * dead-code-eliminated from any production bundle — the env var alone can't
 * turn it on there. Remove this block (and DEV_BYPASS_PARENT_GATE's call
 * site below) once local testing is done; it's not meant to be a permanent
 * fixture.
 */
const DEV_BYPASS_PARENT_GATE =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DEV_BYPASS_PARENT_GATE === "true";

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
    if (DEV_BYPASS_PARENT_GATE) proceedPastGate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The real post-challenge logic — unchanged from before, just pulled out
  // so the dev bypass above can reuse it exactly instead of faking its own
  // version of "what happens after the gate."
  async function proceedPastGate() {
    setChecking(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/sign-in");
      return;
    }

    // If we were sent here to reach a specific destination (e.g. the parent
    // dashboard), go straight there once the check passes.
    if (next) {
      router.push(next);
      return;
    }

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
    // Skip onboarding if this child already picked an avatar/buddy before.
    if (child.avatar_id && child.buddy_id) {
      router.push("/kingdom-map");
    } else {
      router.push("/onboarding/avatar");
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

  if (DEV_BYPASS_PARENT_GATE) {
    return <main className="min-h-screen" />;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
      <Card className="max-w-sm w-full flex flex-col items-center gap-5 text-center">
        <span className="text-5xl">🧮</span>
        <h1 className="font-display text-xl text-kingdom-night">
          Quick check — grown-ups only!
        </h1>
        <p className="font-body text-lg text-kingdom-night/80">
          What is {challenge.a} + {challenge.b}?
        </p>
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          aria-label={`What is ${challenge.a} + ${challenge.b}?`}
          className="w-32 text-center rounded-btn px-4 py-3 border-2 border-kingdom-night/10 font-body text-xl"
        />
        {error && <p className="font-body text-sm text-kingdom-coral">{error}</p>}
        <Button size="md" onClick={handleSubmit} disabled={!input || checking}>
          {checking ? "Checking..." : "Continue"}
        </Button>
      </Card>
    </main>
  );
}


