"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateChild } from "@/lib/supabase/queries";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Per docs/04-user-flows.md: a lightweight "is an adult here" check before
 * any setup screen — not real security, just enough friction that a young
 * child can't stumble through account setup on their own.
 */
function randomChallenge() {
  const a = 3 + Math.floor(Math.random() * 6);
  const b = 3 + Math.floor(Math.random() * 6);
  return { a, b, answer: a + b };
}

export default function ParentGatePage() {
  const router = useRouter();
  const [challenge, setChallenge] = useState(randomChallenge);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setChallenge(randomChallenge());
  }, []);

  async function handleSubmit() {
    if (Number(input) !== challenge.answer) {
      setError("Not quite — try the new question below.");
      setChallenge(randomChallenge());
      setInput("");
      return;
    }

    setChecking(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/sign-in");
      return;
    }

    const child = await getOrCreateChild(supabase, user.id);
    setChecking(false);

    // Skip onboarding if this child already picked an avatar/buddy before.
    if (child.avatar_id && child.buddy_id) {
      router.push("/kingdom-map");
    } else {
      router.push("/onboarding/avatar");
    }
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
