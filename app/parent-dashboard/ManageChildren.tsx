"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { createChild, ChildProfile } from "@/lib/supabase/queries";
import { setActiveChildIdClient } from "@/lib/childSession";
import { AVATARS } from "@/content/avatars";
import { SecondaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";

export function ManageChildren({
  initialChildren,
  activeChildId,
}: {
  initialChildren: ChildProfile[];
  activeChildId: string;
}) {
  const router = useRouter();
  const [children, setChildren] = useState(initialChildren);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    const supabase = createClient();
    const user = await getVerifiedUser(supabase);
    if (!user) {
      setAdding(false);
      return;
    }
    const created = await createChild(supabase, user.id, newName.trim());
    setChildren((prev) => [...prev, created]);
    setNewName("");
    setAdding(false);
  }

  function playAs(childId: string) {
    setActiveChildIdClient(childId);
    router.push("/kingdom-map");
  }

  return (
    <SecondaryCard className="w-full flex flex-col gap-4">
      <h2 className={TEXT.heading}>Children</h2>

      <ul className="flex flex-col gap-2">
        {children.map((child) => {
          const avatar = AVATARS.find((a) => a.id === child.avatar_id);
          const isActive = child.id === activeChildId;
          return (
            <li
              key={child.id}
              className={`flex items-center justify-between rounded-premiumBtn px-4 py-3 ${
                isActive ? "bg-premium-gold/10 border border-premium-gold/30" : "bg-premium-midnightDeep"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{avatar?.emoji ?? "🧒"}</span>
                <div>
                  <p className="font-classic-body text-sm text-premium-ivory">{child.display_name}</p>
                  <p className={`${TEXT.caption} normal-case`}>
                    Day {child.current_day}
                    {isActive ? " · Currently viewing" : ""}
                  </p>
                </div>
              </div>
              <Button tone="premium" size="md" variant="ghost" onClick={() => playAs(child.id)}>
                Play →
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="New child's name"
          aria-label="New child's name"
          className="flex-1 rounded-premiumBtn px-4 py-2 border border-white/15 bg-premium-midnightDeep text-premium-ivory font-classic-body placeholder:text-premium-ivory/30"
          maxLength={40}
        />
        <Button tone="premium" size="md" onClick={handleAdd} disabled={!newName.trim() || adding}>
          {adding ? "Adding..." : "+ Add Child"}
        </Button>
      </div>
    </SecondaryCard>
  );
}
