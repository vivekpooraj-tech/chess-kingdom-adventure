"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SecondaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";

interface ScreenTimeSettingsProps {
  parentId: string;
  initialWeekday: number;
  initialWeekend: number;
}

export function ScreenTimeSettings({
  parentId,
  initialWeekday,
  initialWeekend,
}: ScreenTimeSettingsProps) {
  const [weekday, setWeekday] = useState(initialWeekday);
  const [weekend, setWeekend] = useState(initialWeekend);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    const { error } = await supabase
      .from("parents")
      .update({
        screen_time_weekday_minutes: weekday,
        screen_time_weekend_minutes: weekend,
      })
      .eq("id", parentId);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <SecondaryCard className="w-full max-w-lg flex flex-col gap-4">
      <h2 className={TEXT.heading}>Screen Time</h2>

      <label className="flex flex-col gap-1">
        <span className={`${TEXT.caption} normal-case`}>Weekday limit (minutes)</span>
        <input
          type="number"
          min={0}
          max={480}
          value={weekday}
          onChange={(e) => setWeekday(Number(e.target.value))}
          className="rounded-premiumBtn px-4 py-2 border border-white/15 bg-premium-midnightDeep text-premium-ivory font-classic-body"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={`${TEXT.caption} normal-case`}>Weekend limit (minutes)</span>
        <input
          type="number"
          min={0}
          max={480}
          value={weekend}
          onChange={(e) => setWeekend(Number(e.target.value))}
          className="rounded-premiumBtn px-4 py-2 border border-white/15 bg-premium-midnightDeep text-premium-ivory font-classic-body"
        />
      </label>

      <div className="flex items-center gap-3">
        <Button tone="premium" size="md" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        {saved && <span className="font-classic-body text-sm text-emerald-400">Saved</span>}
      </div>

      <p className={`${TEXT.caption} normal-case italic`}>
        These limits are stored but not yet enforced in the app — the lock-after-time-expires
        behavior described in the product plan is a future update.
      </p>
    </SecondaryCard>
  );
}
