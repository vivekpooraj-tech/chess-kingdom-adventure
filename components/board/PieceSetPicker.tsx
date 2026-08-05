"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PIECE_SETS, DEFAULT_PIECE_SET_ID } from "@/content/pieceSets";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild, updateChildPieceSet } from "@/lib/supabase/queries";
import { getActiveChildIdClient, setActiveChildIdClient } from "@/lib/childSession";

/**
 * Shared by the onboarding step (app/onboarding/pieces) and the anytime
 * editor reachable from the Kingdom Map (app/kingdom-map/piece-set) — same
 * picker UI as BoardSkinPicker, different heading/button copy and post-save
 * destination. Piece choice is independent of board skin, so this doesn't
 * need to know or care which board is selected.
 */
export function PieceSetPicker({
  heading,
  confirmLabel,
  redirectTo,
}: {
  heading: string;
  confirmLabel: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(DEFAULT_PIECE_SET_ID);
  const [childId, setChildId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-12">
      <h1 className="font-display text-3xl text-kingdom-night text-center">{heading}</h1>

      <div className="grid grid-cols-2 gap-5 max-w-md w-full">
        {PIECE_SETS.map((set) => {
          const folder = set.folder ? `${set.folder}/` : "";
          return (
            <motion.button
              key={set.id}
              onClick={() => setSelected(set.id)}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-3 rounded-card p-4 shadow-toy bg-white/70"
              style={{ outline: selected === set.id ? "4px solid #FFC53D" : "none" }}
            >
              <div className="flex items-center justify-center gap-3 w-full aspect-[2/1]">
                {/* width/height are the SVG's real intrinsic dimensions (HTML
                    attributes, not CSS) — object-fit: contain (see the
                    matching comment in ChessBoard.tsx) then scales each into
                    its fixed box preserving aspect ratio. */}
                <img
                  src={`/pieces/${folder}light/king.svg`}
                  alt=""
                  width={set.intrinsicSize.width}
                  height={set.intrinsicSize.height}
                  style={{ width: "45%", height: "100%", objectFit: "contain" }}
                  draggable={false}
                />
                <img
                  src={`/pieces/${folder}dark/king.svg`}
                  alt=""
                  width={set.intrinsicSize.width}
                  height={set.intrinsicSize.height}
                  style={{ width: "45%", height: "100%", objectFit: "contain" }}
                  draggable={false}
                />
              </div>
              <span className="font-display text-sm text-kingdom-night text-center">
                {set.emoji} {set.name}
              </span>
            </motion.button>
          );
        })}
      </div>

      {error && <p className="font-body text-sm text-kingdom-coral text-center">{error}</p>}

      <Button size="lg" disabled={!selected || saving} onClick={confirm}>
        {saving ? "Saving..." : confirmLabel}
      </Button>
    </main>
  );
}
