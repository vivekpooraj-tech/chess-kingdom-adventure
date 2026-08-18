"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild, createInviteGame } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { Button } from "@/components/ui/Button";
import { GameLimitPaywall } from "@/components/upgrade/GameLimitPaywall";
import { getTimeControlsByCategory, TimeControl } from "@/content/timeControls";
import { TEXT } from "@/lib/designSystem";

type Category = TimeControl["description"];

const SELECT_CLASS =
  "w-full rounded-premiumBtn px-3.5 py-2.5 text-sm font-classic-body border border-white/15 bg-premium-midnightDeep text-premium-ivory " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-premium-midnight " +
  "hover:border-premium-gold/40 transition-colors";

/**
 * Game Type + Time Control as two dropdowns instead of one row of 7
 * horizontal cards — the full TIME_CONTROLS list no longer fits a normal
 * card width without squeezing the description text into a narrow column.
 * Time Control options are filtered to the selected category via the same
 * getTimeControlsByCategory() the Group Tournament create form already
 * uses — no new time-control data, same ids/values reach createInviteGame.
 */
export function InviteFriendButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<Category>("Blitz");
  const blitzOptions = getTimeControlsByCategory("Blitz");
  const rapidOptions = getTimeControlsByCategory("Rapid");
  const [timeControlId, setTimeControlId] = useState(blitzOptions[3]?.id ?? blitzOptions[0].id);
  const [showPaywall, setShowPaywall] = useState(false);

  const options = category === "Blitz" ? blitzOptions : rapidOptions;

  function handleCategoryChange(next: Category) {
    setCategory(next);
    const nextOptions = next === "Blitz" ? blitzOptions : rapidOptions;
    if (!nextOptions.some((tc) => tc.id === timeControlId)) {
      setTimeControlId(nextOptions[0].id);
    }
  }

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
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col sm:flex-row gap-3">
        <label className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className={`${TEXT.caption} uppercase tracking-wide`}>Game Type</span>
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value as Category)}
            className={SELECT_CLASS}
          >
            <option value="Blitz">Blitz</option>
            <option value="Rapid">Rapid</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className={`${TEXT.caption} uppercase tracking-wide`}>Time Control</span>
          <select
            value={timeControlId}
            onChange={(e) => setTimeControlId(e.target.value)}
            className={SELECT_CLASS}
          >
            {options.map((tc) => (
              <option key={tc.id} value={tc.id}>
                {tc.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Button onClick={handleClick} disabled={loading} className="w-full sm:w-auto sm:self-end">
        {loading ? "Creating..." : "Invite a Friend to Play →"}
      </Button>
      {showPaywall && <GameLimitPaywall gameType="multiplayer" onDismiss={() => setShowPaywall(false)} />}
    </div>
  );
}
