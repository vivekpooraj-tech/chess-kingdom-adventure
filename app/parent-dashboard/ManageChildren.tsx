"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createChild, ChildProfile } from "@/lib/supabase/queries";
import { setActiveChildIdClient } from "@/lib/childSession";
import { AVATARS } from "@/content/avatars";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
    <Card className="w-full max-w-lg flex flex-col gap-4">
      <h2 className="font-display text-lg text-kingdom-night">Children</h2>

      <ul className="flex flex-col gap-2">
        {children.map((child) => {
          const avatar = AVATARS.find((a) => a.id === child.avatar_id);
          const isActive = child.id === activeChildId;
          return (
            <li
              key={child.id}
              className={`flex items-center justify-between rounded-card px-4 py-3 ${
                isActive ? "bg-kingdom-gold/20" : "bg-kingdom-night/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{avatar?.emoji ?? "🧒"}</span>
                <div>
                  <p className="font-body text-kingdom-night">{child.display_name}</p>
                  <p className="font-body text-xs text-kingdom-night/50">
                    Day {child.current_day}
                    {isActive ? " · Currently viewing" : ""}
                  </p>
                </div>
              </div>
              <Button size="md" variant="ghost" onClick={() => playAs(child.id)}>
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
          className="flex-1 rounded-btn px-4 py-2 border-2 border-kingdom-night/10 font-body"
          maxLength={40}
        />
        <Button size="md" onClick={handleAdd} disabled={!newName.trim() || adding}>
          {adding ? "Adding..." : "+ Add Child"}
        </Button>
      </div>
    </Card>
  );
}
