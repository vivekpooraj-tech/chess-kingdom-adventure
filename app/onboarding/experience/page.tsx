"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, updateChildExperienceProfile } from "@/lib/supabase/queries";
import { getActiveChildIdClient, setActiveChildIdClient } from "@/lib/childSession";
import {
  AGE_BAND_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  type AgeBand,
  type ExperienceLevel,
} from "@/lib/learner/experienceLevel";
import { invalidateActiveChildCache } from "@/lib/supabase/activeChildCache";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";

export default function ExperienceOnboardingPage() {
  const router = useRouter();
  const [childId, setChildId] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
  const [saving, setSaving] = useState(false);

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
      if (child.experience_level) {
        router.replace(child.avatar_id && child.buddy_id ? "/kingdom-map" : "/onboarding/avatar");
      }
    }
    load();
  }, [router]);

  async function confirm() {
    if (!childId || !experienceLevel) return;
    setSaving(true);
    const supabase = createClient();
    const user = await getVerifiedUser(supabase);
    if (!user) return;
    await updateChildExperienceProfile(supabase, childId, experienceLevel, ageBand);
    invalidateActiveChildCache(user.id);
    setSaving(false);
    router.push("/onboarding/avatar");
  }

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="max-w-lg w-full flex flex-col gap-6 text-center">
        <h1 className={TEXT.display}>How familiar are you with chess?</h1>
        <p className={TEXT.body}>This helps Chess Mind recommend the right starting point.</p>

        <div className="flex flex-col gap-3 text-left">
          {EXPERIENCE_LEVEL_OPTIONS.map((option) => {
            const selected = experienceLevel === option.value;
            return (
              <motion.button
                key={option.value}
                type="button"
                onClick={() => setExperienceLevel(option.value)}
                whileTap={{ scale: 0.98 }}
                className={`rounded-premiumCard border p-4 text-left transition-colors ${
                  selected
                    ? "border-premium-gold/50 bg-premium-gold/10"
                    : "border-white/10 bg-premium-navy/40"
                }`}
              >
                <p className="font-classic-display text-base text-premium-ivory">{option.label}</p>
                <p className={`${TEXT.caption} mt-1 normal-case`}>{option.description}</p>
              </motion.button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 text-left">
          <p className={`${TEXT.caption} uppercase tracking-wide`}>Age range (optional)</p>
          <div className="grid grid-cols-2 gap-2">
            {AGE_BAND_OPTIONS.map((option) => {
              const selected = ageBand === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAgeBand(selected ? null : option.value)}
                  className={`rounded-premiumBtn px-3 py-2 text-sm font-classic-body border transition-colors ${
                    selected
                      ? "border-premium-gold/50 text-premium-gold bg-premium-gold/10"
                      : "border-white/10 text-premium-ivory/70"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          tone="premium"
          size="lg"
          className="w-full"
          onClick={confirm}
          disabled={!experienceLevel || saving}
        >
          {saving ? "Saving..." : "Continue"}
        </Button>
      </div>
    </main>
  );
}
