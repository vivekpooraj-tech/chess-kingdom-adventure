"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { TEXT } from "@/lib/designSystem";
import { isLichessEligible } from "@/lib/lichess/eligibility";
import { exchangeCode, fetchAccountName, takePending, validateCallback } from "@/lib/lichess/oauth";
import { saveConnection } from "@/lib/lichess/tokenStore";

// A callback can be delivered twice (React StrictMode double-mount, the Android deep link arriving via both launch URL and appUrlOpen). The
// pending authorization is single-use, so the work runs ONCE per state and every mount subscribes to the same result. Only the state is
// remembered at module scope: the code and any token stay inside runCallback().
const runs = new Map<string, Promise<Outcome>>();

type Outcome = { status: "done" } | { status: "error"; message: string } | { status: "signin" };

const MESSAGES: Record<string, string> = {
  denied: "The Lichess connection was cancelled.",
  no_pending: "This sign-in link is no longer valid. Please start again from More.",
  expired: "That sign-in took too long. Please start again from More.",
  state_mismatch: "We couldn't verify that sign-in. Please start again from More.",
  wrong_profile: "That sign-in was started on a different profile. Please start again from More.",
  no_code: "Lichess didn't send a sign-in code. Please start again from More.",
  // Deliberately generic: a profile that is not an adult must never see Lichess-specific wording here.
  not_eligible: "This page isn't available.",
  network: "Couldn't reach Lichess. Please try again from More.",
  rejected: "Lichess didn't accept the sign-in. Please try again from More.",
};

const fail = (reason: string): Outcome => ({ status: "error", message: MESSAGES[reason] ?? MESSAGES.rejected });

async function runCallback(code: string | null, state: string | null, error: string | null): Promise<Outcome> {
  const pending = takePending();
  const supabase = createClient();
  const user = await getVerifiedUser(supabase).catch(() => null);
  if (!user) return { status: "signin" };
  const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient()).catch(() => null);
  const child = resolution?.child ?? null;

  // Fail closed FIRST. Eligibility is checked here, not only where the button is shown, and before anything else: a profile that is not an
  // adult (minor, teen, tween, young, no age band, or no resolvable profile) gets the generic page below with a way back to More, never a
  // Lichess-specific message and never a token request.
  if (!isLichessEligible(child?.age_band)) return fail("not_eligible");

  const check = validateCallback(pending, { code, state, error }, child?.id ?? null, Date.now());
  if (!check.ok) return fail(check.reason);
  if (!pending || !code) return fail("rejected");

  try {
    const { token, expiresInSec } = await exchangeCode(code, pending.verifier, pending.redirectUri);
    const username = await fetchAccountName(token);
    saveConnection(pending.childId, token, username, expiresInSec);
    return { status: "done" };
  } catch (e) {
    return fail((e as { kind?: string })?.kind ?? "rejected");
  }
}

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    const key = state ?? `none:${error ?? ""}`;
    let run = runs.get(key);
    if (!run) {
      run = runCallback(code, state, error);
      runs.set(key, run);
    }
    let cancelled = false;
    let timer: number | undefined;
    run.then((o) => {
      if (cancelled) return;
      if (o.status === "signin") {
        router.replace("/sign-in");
        return;
      }
      setOutcome(o);
      if (o.status === "done") timer = window.setTimeout(() => router.replace("/more"), 700);
    });
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [params, router]);

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      {outcome === null && <p className={`${TEXT.body} animate-pulse`}>Connecting Lichess…</p>}
      {outcome?.status === "done" && <p className={TEXT.body}>Lichess connected.</p>}
      {outcome?.status === "error" && (
        <>
          <p role="alert" className="font-classic-body text-sm text-red-300 max-w-sm">
            {outcome.message}
          </p>
          <Link href="/more" className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/70 underline underline-offset-2">
            Back to More
          </Link>
        </>
      )}
    </main>
  );
}

export default function LichessCallbackPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <CallbackInner />
    </Suspense>
  );
}
