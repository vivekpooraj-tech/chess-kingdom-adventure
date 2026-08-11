"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild, createInviteGame } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { Button } from "@/components/ui/Button";
import { GameLimitPaywall } from "@/components/upgrade/GameLimitPaywall";
import { TIME_CONTROLS, DEFAULT_TIME_CONTROL_ID } from "@/content/timeControls";

export function InviteFriendButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [timeControlId, setTimeControlId] = useState(DEFAULT_TIME_CONTROL_ID);
  const [showPaywall, setShowPaywall] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
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
      // create_invite_game checks the host's free-multiplayer eligibility
      // server-side before creating anything — no credit is spent here
      // either way, since sharing a link nobody joins isn't a game that
      // started (see supabase/migrations/0019_daily_free_game_limits.sql).
      const result = await createInviteGame(supabase, resolution.child!.id, timeControlId);
      if (result.blocked || !result.id) {
        setShowPaywall(true);
        return;
      }
      router.push(`/online/${result.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex gap-2" role="radiogroup" aria-label="Time control">
        {TIME_CONTROLS.map((tc) => (
          <button
            key={tc.id}
            type="button"
            role="radio"
            aria-checked={timeControlId === tc.id}
            onClick={() => setTimeControlId(tc.id)}
            className={`flex flex-col items-center rounded-premiumBtn border px-3 py-1.5 font-classic-body transition-colors ${
              timeControlId === tc.id
                ? "border-premium-gold bg-premium-navyLight text-premium-ivory"
                : "border-white/10 bg-premium-navy/60 text-premium-ivory/60 hover:border-premium-gold/30"
            }`}
          >
            <span className="text-sm">{tc.label}</span>
            <span className="text-[11px] text-premium-ivory/50">{tc.description}</span>
          </button>
        ))}
      </div>
      <Button onClick={handleClick} disabled={loading}>
        {loading ? "Creating..." : "Invite a Friend to Play →"}
      </Button>
      {showPaywall && <GameLimitPaywall gameType="multiplayer" onDismiss={() => setShowPaywall(false)} />}
    </div>
  );
}
