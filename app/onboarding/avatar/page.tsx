"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AVATARS } from "@/content/avatars";
import { Button } from "@/components/ui/Button";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, updateChildAvatar } from "@/lib/supabase/queries";
import { getActiveChildIdClient, setActiveChildIdClient } from "@/lib/childSession";

export default function AvatarPickerPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
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
      if (child.avatar_id) setSelected(child.avatar_id);
    }
    load();
  }, [router]);

  async function confirm() {
    if (!selected || !childId) return;
    setSaving(true);
    const supabase = createClient();
    await updateChildAvatar(supabase, childId, selected);
    setSaving(false);
    router.push("/onboarding/buddy");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-12">
      <h1 className="font-display text-3xl text-kingdom-night text-center">
        Choose your hero! 🌟
      </h1>

      <div className="grid grid-cols-2 gap-5 max-w-md w-full">
        {AVATARS.map((a) => (
          <motion.button
            key={a.id}
            onClick={() => setSelected(a.id)}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-2 rounded-card p-5 shadow-toy"
            style={{
              background: `linear-gradient(135deg, ${a.colorFrom}33, ${a.colorTo}33)`,
              outline: selected === a.id ? "4px solid #FFC53D" : "none",
            }}
          >
            <span className="text-6xl">{a.emoji}</span>
            <span className="font-display text-lg text-kingdom-night">{a.name}</span>
          </motion.button>
        ))}
      </div>

      <Button size="lg" disabled={!selected || saving} onClick={confirm}>
        {saving ? "Saving..." : "Next →"}
      </Button>
    </main>
  );
}
