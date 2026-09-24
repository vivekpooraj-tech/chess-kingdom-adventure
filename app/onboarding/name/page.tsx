"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, updateChildName } from "@/lib/supabase/queries";
import { getActiveChildIdClient, setActiveChildIdClient } from "@/lib/childSession";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";

const MIN_LENGTH = 1;
const MAX_LENGTH = 30;

export default function NameOnboardingPage() {
  const router = useRouter();
  const [childId, setChildId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const user = await getVerifiedUser(supabase);
      if (!user) {
        router.push("/sign-in");
        return;
      }
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (resolution.needsSelection) {
        router.push("/choose-child");
        return;
      }
      const child = resolution.child!;
      setActiveChildIdClient(child.id);
      setChildId(child.id);
      // Prefill for a child created with a name already (e.g. via the
      // Parent Dashboard's "add another child") so they aren't asked again
      // for something already on record — just given a chance to confirm it.
      if (child.display_name) setName(child.display_name);
    }
    load();
  }, [router]);

  const trimmed = name.trim();
  const valid = trimmed.length >= MIN_LENGTH && trimmed.length <= MAX_LENGTH;

  async function confirm() {
    if (!childId || !valid) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    try {
      await updateChildName(supabase, childId, trimmed);
      router.push("/onboarding/gender");
    } catch {
      setError("We couldn't save your name. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="max-w-lg w-full flex flex-col gap-6 text-center">
        <h1 className={TEXT.display}>What&apos;s your name?</h1>
        <p className={TEXT.body}>This is how Chess Mind will greet you.</p>

        <div className="flex flex-col gap-2 text-left">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && valid && !saving && confirm()}
            maxLength={MAX_LENGTH}
            placeholder="Enter your name"
            aria-label="Your name"
            autoFocus
            className="w-full rounded-premiumCard border border-white/10 bg-premium-navy/40 px-4 py-3 text-center font-classic-display text-lg text-premium-ivory placeholder:text-premium-ivory/30 focus:outline-none focus:border-premium-gold/60 focus:ring-2 focus:ring-premium-gold/20"
          />
          {error && <p className="font-classic-body text-sm text-semantic-retry text-center">{error}</p>}
        </div>

        <Button
          tone="premium"
          size="lg"
          className="w-full"
          onClick={confirm}
          disabled={!valid || saving}
        >
          {saving ? "Saving..." : "Continue"}
        </Button>
      </div>
    </main>
  );
}
