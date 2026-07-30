"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BUDDIES } from "@/content/buddies";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild, updateChildBuddy } from "@/lib/supabase/queries";
import { getActiveChildIdClient, setActiveChildIdClient } from "@/lib/childSession";

export default function BuddyPickerPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("wise-owl"); // v1 default
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
      if (child.buddy_id) setSelected(child.buddy_id);
    }
    load();
  }, [router]);

  async function confirm() {
    if (!childId) return;
    setSaving(true);
    const supabase = createClient();
    await updateChildBuddy(supabase, childId, selected);
    setSaving(false);
    router.push("/kingdom-map");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-12">
      <h1 className="font-display text-3xl text-kingdom-night text-center">
        Pick your Kingdom Buddy! 🐾
      </h1>

      <div className="grid grid-cols-3 gap-4 max-w-lg w-full">
        {BUDDIES.map((b) => (
          <motion.button
            key={b.id}
            disabled={!b.builtIn}
            onClick={() => b.builtIn && setSelected(b.id)}
            whileTap={b.builtIn ? { scale: 0.95 } : {}}
            className="relative flex flex-col items-center gap-2 rounded-card p-4 shadow-toy bg-white/70 disabled:opacity-40"
            style={{ outline: selected === b.id ? "4px solid #FFC53D" : "none" }}
          >
            <span className="text-5xl">{b.emoji}</span>
            <span className="font-display text-sm text-kingdom-night text-center">{b.name}</span>
            {!b.builtIn && (
              <span className="absolute -top-2 -right-2 bg-kingdom-coral text-white text-[10px] font-bold px-2 py-1 rounded-full">
                Soon!
              </span>
            )}
          </motion.button>
        ))}
      </div>

      <Button size="lg" disabled={saving} onClick={confirm}>
        {saving ? "Saving..." : `Meet ${BUDDIES.find((b) => b.id === selected)?.name}! →`}
      </Button>
    </main>
  );
}
