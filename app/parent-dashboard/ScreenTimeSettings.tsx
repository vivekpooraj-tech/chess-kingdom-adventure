"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
    <Card className="w-full max-w-lg flex flex-col gap-4">
      <h2 className="font-display text-lg text-kingdom-night">Screen Time</h2>

      <label className="flex flex-col gap-1">
        <span className="font-body text-sm text-kingdom-night/70">
          Weekday limit (minutes)
        </span>
        <input
          type="number"
          min={0}
          max={480}
          value={weekday}
          onChange={(e) => setWeekday(Number(e.target.value))}
          className="rounded-btn px-4 py-2 border-2 border-kingdom-night/10 font-body"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-body text-sm text-kingdom-night/70">
          Weekend limit (minutes)
        </span>
        <input
          type="number"
          min={0}
          max={480}
          value={weekend}
          onChange={(e) => setWeekend(Number(e.target.value))}
          className="rounded-btn px-4 py-2 border-2 border-kingdom-night/10 font-body"
        />
      </label>

      <div className="flex items-center gap-3">
        <Button size="md" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        {saved && <span className="font-body text-sm text-kingdom-forest">Saved!</span>}
      </div>

      <p className="font-body text-xs text-kingdom-night/40 italic">
        These limits are stored but not yet enforced in the app — the lock-after-time-expires
        behavior described in the product plan is a future update.
      </p>
    </Card>
  );
}
