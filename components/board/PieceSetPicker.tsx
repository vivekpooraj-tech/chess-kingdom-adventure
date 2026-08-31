"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PIECE_SETS, DEFAULT_PIECE_SET_ID } from "@/content/pieceSets";
import { PieceImage } from "@/components/board/PieceImage";
import { Button } from "@/components/ui/Button";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, updateChildPieceSet } from "@/lib/supabase/queries";
import { getActiveChildIdClient, setActiveChildIdClient } from "@/lib/childSession";
import { TEXT } from "@/lib/designSystem";

/**
 * Shared by the onboarding step (app/onboarding/pieces) and the anytime
 * editor reachable from Profile (app/kingdom-map/piece-set) — same picker
 * UI as BoardSkinPicker, different heading/button copy and post-save
 * destination. Piece choice is independent of board skin, so this doesn't
 * need to know or care which board is selected. `tone` keeps onboarding on
 * its existing bright style while the anytime editor uses the premium
 * system (same pattern as Button/Card's tone prop).
 */
export function PieceSetPicker({
  heading,
  confirmLabel,
  redirectTo,
  tone = "adventure",
}: {
  heading: string;
  confirmLabel: string;
  redirectTo: string;
  tone?: "adventure" | "premium";
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(DEFAULT_PIECE_SET_ID);
  const [childId, setChildId] = useState<string | null>(null);
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
      setSelected(child.piece_set_id);
    }
    load();
  }, [router]);

  async function confirm() {
    if (!childId) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      await updateChildPieceSet(supabase, childId, selected);
      router.push(redirectTo);
    } catch (err) {
      console.error("Failed to save piece set", err);
      setError("Couldn't save that — please try again.");
      setSaving(false);
    }
  }

  const premium = tone === "premium";

  return (
    <main
      className={`min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-12 ${
        premium ? "bg-premium-midnight" : ""
      }`}
    >
      <h1 className={premium ? TEXT.display : "font-display text-3xl text-kingdom-night text-center"}>
        {heading}
      </h1>

      <div className="grid grid-cols-2 gap-5 max-w-md w-full">
        {PIECE_SETS.map((set) => {
          const isSelected = selected === set.id;
          return (
            <motion.button
              key={set.id}
              onClick={() => setSelected(set.id)}
              whileTap={{ scale: 0.95 }}
              className={
                premium
                  ? "flex flex-col items-center gap-3 rounded-premiumCard p-4 bg-premium-navy shadow-premiumCard border"
                  : "flex flex-col items-center gap-3 rounded-card p-4 shadow-toy bg-white/70"
              }
              style={
                premium
                  ? { borderColor: isSelected ? "#D4AF37" : "rgba(255,255,255,0.08)", borderWidth: isSelected ? 2 : 1 }
                  : { outline: isSelected ? "4px solid #FFC53D" : "none" }
              }
            >
              <div className="flex items-center justify-center gap-3 w-full aspect-[2/1]">
                <span className="flex h-full w-[45%] items-center justify-center">
                  <PieceImage set={set} piece="k" color="w" fill />
                </span>
                <span className="flex h-full w-[45%] items-center justify-center">
                  <PieceImage set={set} piece="k" color="b" fill />
                </span>
              </div>
              <span
                className={
                  premium
                    ? "font-classic-display text-sm text-premium-ivory text-center"
                    : "font-display text-sm text-kingdom-night text-center"
                }
              >
                {set.emoji} {set.name}
              </span>
            </motion.button>
          );
        })}
      </div>

      {error && (
        <p className={premium ? "font-classic-body text-sm text-red-300 text-center" : "font-body text-sm text-kingdom-coral text-center"}>
          {error}
        </p>
      )}

      <Button tone={tone} size="lg" disabled={!selected || saving} onClick={confirm}>
        {saving ? "Saving..." : confirmLabel}
      </Button>
    </main>
  );
}
