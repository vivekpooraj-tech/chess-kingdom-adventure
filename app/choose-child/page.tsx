"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { getChildrenForParent, ChildProfile } from "@/lib/supabase/queries";
import { setActiveChildIdClient } from "@/lib/childSession";
import { AVATARS } from "@/content/avatars";

export default function ChooseChildPage() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const user = await getVerifiedUser(supabase);
      if (!user) {
        router.push("/sign-in");
        return;
      }
      const list = await getChildrenForParent(supabase, user.id);
      setChildren(list);
      setLoading(false);
    }
    load();
  }, [router]);

  function choose(child: ChildProfile) {
    setActiveChildIdClient(child.id);
    if (!child.experience_level) {
      router.push("/onboarding/experience");
    } else if (child.avatar_id && child.buddy_id) {
      router.push("/kingdom-map");
    } else {
      router.push("/onboarding/avatar");
    }
  }

  if (loading) {
    return <main className="min-h-screen" />;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-12">
      <h1 className="font-display text-3xl text-kingdom-night text-center">
        Who&apos;s playing today?
      </h1>

      <div className="grid grid-cols-2 gap-5 max-w-md w-full">
        {children.map((child) => {
          const avatar = AVATARS.find((a) => a.id === child.avatar_id);
          return (
            <motion.button
              key={child.id}
              onClick={() => choose(child)}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-2 rounded-card p-5 shadow-toy bg-white/80"
            >
              <span className="text-6xl">{avatar?.emoji ?? "🧒"}</span>
              <span className="font-display text-lg text-kingdom-night">
                {child.display_name}
              </span>
            </motion.button>
          );
        })}
      </div>

      <p className="font-body text-sm text-kingdom-night/40">
        A parent can add more players from the Parent Dashboard.
      </p>
    </main>
  );
}
