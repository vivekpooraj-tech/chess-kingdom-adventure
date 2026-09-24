"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, updateChildGender, type ChildGender } from "@/lib/supabase/queries";
import { getActiveChildIdClient, setActiveChildIdClient } from "@/lib/childSession";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";

const OPTIONS: { value: ChildGender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unspecified", label: "Prefer not to say" },
];

export default function GenderOnboardingPage() {
  const router = useRouter();
  const [childId, setChildId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChildGender | null>(null);
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
      if (child.gender) setSelected(child.gender);
    }
    load();
  }, [router]);

  async function confirm() {
    if (!childId || !selected) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    try {
      await updateChildGender(supabase, childId, selected);
      router.push("/onboarding/avatar");
    } catch {
      setError("We couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="max-w-lg w-full flex flex-col gap-6 text-center">
        <h1 className={TEXT.display}>Tell us about you</h1>

        <div className="flex flex-col gap-3 text-left">
          {OPTIONS.map((option) => {
            const isSelected = selected === option.value;
            return (
              <motion.button
                key={option.value}
                type="button"
                onClick={() => setSelected(option.value)}
                whileTap={{ scale: 0.98 }}
                className={`min-h-[44px] rounded-premiumCard border p-4 text-left transition-colors ${
                  isSelected
                    ? "border-premium-gold/50 bg-premium-gold/10"
                    : "border-white/10 bg-premium-navy/40"
                }`}
              >
                <p className="font-classic-display text-base text-premium-ivory">{option.label}</p>
              </motion.button>
            );
          })}
        </div>

        {error && <p className="font-classic-body text-sm text-semantic-retry text-center">{error}</p>}

        <Button
          tone="premium"
          size="lg"
          className="w-full"
          onClick={confirm}
          disabled={!selected || saving}
        >
          {saving ? "Saving..." : "Continue"}
        </Button>
      </div>
    </main>
  );
}
