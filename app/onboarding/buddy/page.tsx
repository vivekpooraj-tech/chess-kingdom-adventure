"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BUDDIES } from "@/content/buddies";
import { WorldScope } from "@/components/layout/WorldScope";
import { GuidePicker } from "@/components/onboarding/GuidePicker";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
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
    router.push("/onboarding/board");
  }

  // Presentation only: the five guides that are not built yet are no longer drawn at all (they were disabled "Soon!" cards that could never be
  // selected, so nothing about the saved value changes). The guide shown is the one built-in entry of content/buddies.ts, which is left untouched
  // because Home, lessons, the parent dashboard and the post-game screen still read the whole list. Load, selection state, save and redirect are as before.
  const guide = BUDDIES.find((b) => b.builtIn) ?? BUDDIES[0];
  return (
    <WorldScope world="enchanted">
      <main className="cp cp--guide min-h-screen">
        <GuidePicker guide={guide} saving={saving} onConfirm={confirm} />
      </main>
    </WorldScope>
  );
}
