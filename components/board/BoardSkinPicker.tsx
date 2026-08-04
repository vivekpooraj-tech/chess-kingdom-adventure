"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BOARD_SKINS, DEFAULT_BOARD_SKIN_ID } from "@/content/boardSkins";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild, updateChildBoardSkin } from "@/lib/supabase/queries";
import { getActiveChildIdClient, setActiveChildIdClient } from "@/lib/childSession";

/**
 * Shared by the onboarding step (app/onboarding/board) and the anytime
 * editor reachable from the Kingdom Map (app/kingdom-map/board-skin) — same
 * picker UI, different heading/button copy and post-save destination.
 */
export function BoardSkinPicker({
  heading,
  confirmLabel,
  redirectTo,
}: {
  heading: string;
  confirmLabel: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(DEFAULT_BOARD_SKIN_ID);
  const [childId, setChildId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      setSelected(child.board_skin_id);
    }
    load();
  }, [router]);

  async function confirm() {
    if (!childId) return;
    setSaving(true);
    const supabase = createClient();
    await updateChildBoardSkin(supabase, childId, selected);
    setSaving(false);
    router.push(redirectTo);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-12">
      <h1 className="font-display text-3xl text-kingdom-night text-center">{heading}</h1>

      <div className="grid grid-cols-2 gap-5 max-w-md w-full">
        {BOARD_SKINS.map((skin) => (
          <motion.button
            key={skin.id}
            onClick={() => setSelected(skin.id)}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-3 rounded-card p-4 shadow-toy bg-white/70"
            style={{ outline: selected === skin.id ? "4px solid #FFC53D" : "none" }}
          >
            <div className="grid grid-cols-4 grid-rows-2 w-full aspect-[2/1] rounded-btn overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => {
                const row = Math.floor(i / 4);
                const col = i % 4;
                const isDark = (row + col) % 2 === 1;
                return (
                  <div
                    key={i}
                    style={{ backgroundColor: isDark ? skin.darkSquare : skin.lightSquare }}
                  />
                );
              })}
            </div>
            <span className="font-display text-sm text-kingdom-night text-center">
              {skin.emoji} {skin.name}
            </span>
          </motion.button>
        ))}
      </div>

      <Button size="lg" disabled={!selected || saving} onClick={confirm}>
        {saving ? "Saving..." : confirmLabel}
      </Button>
    </main>
  );
}
