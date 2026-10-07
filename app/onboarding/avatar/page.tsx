"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AVATARS } from "@/content/avatars";
import { WorldScope } from "@/components/layout/WorldScope";
import { CompanionPicker } from "@/components/onboarding/CompanionPicker";
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

  // Presentation only: the picker draws the same AVATARS and calls the same handlers (select / confirm). WorldScope pins the Enchanted Kingdom look
  // for this signup step; nothing about the load, the selection state, the save or the redirect above has changed.
  return (
    <WorldScope world="enchanted">
      <main className="cp min-h-screen">
        <CompanionPicker avatars={AVATARS} selected={selected} saving={saving} onSelect={setSelected} onConfirm={confirm} />
      </main>
    </WorldScope>
  );
}
