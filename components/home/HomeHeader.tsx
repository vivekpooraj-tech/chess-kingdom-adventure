import { Avatar } from "@/components/ui/Avatar";
import Link from "next/link";
import { AvatarOption } from "@/lib/types";
import { KingdomZone } from "@/content/kingdomZones";
import { FlameIcon } from "@/components/nav/icons";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";

export function HomeHeader({
  displayName,
  avatar,
  zone,
  currentDay,
  totalDays,
  streak,
  rating,
}: {
  displayName: string;
  avatar: AvatarOption | undefined;
  /** Kingdom Journey zone + day framing. Omit both `zone` and `currentDay`/
   * `totalDays` to hide this row entirely — Home (Phase 3) no longer leads
   * with Kingdom Journey's day count, since Chess School V2 is the
   * flagship curriculum now. Profile still passes all three, unchanged. */
  zone?: KingdomZone;
  currentDay?: number;
  totalDays?: number;
  /** Consecutive-day Chess Mind activity streak — the one real, measured
   * streak in the app currently (see getChessMindStreak). Shown here as
   * the header's general streak per the Phase 10B brief; 0 hides it. */
  streak: number;
  /** Real children.rating value — omit to hide the badge entirely (used on
   * Profile, which already shows a bigger dedicated rating card of its
   * own, so repeating it here would be redundant). Never a hardcoded
   * fallback like 1200 — always the actual value or nothing. */
  rating?: number;
}) {
  const showJourneyRow = typeof currentDay === "number" && typeof totalDays === "number" && totalDays > 0;
  const progressPercent = showJourneyRow
    ? Math.min(100, Math.round((Math.min(currentDay! - 1, totalDays!) / totalDays!) * 100))
    : 0;

  return (
    <div className="w-full h-full rounded-premiumCard bg-premium-midnight text-premium-ivory p-5 flex flex-col gap-4 shadow-premiumCard">
      <div className="flex items-center gap-3">
        <Avatar
          size="lg"
          emoji={avatar?.emoji ?? "🧑"}
          colorFrom={avatar?.colorFrom ?? "#28315A"}
          colorTo={avatar?.colorTo ?? "#28315A"}
        />
        <div className="flex-1 min-w-0">
          <p className="font-classic-display text-lg leading-tight truncate">{displayName}</p>
          {zone && (
            <p className="font-classic-body text-xs text-premium-gold/90 flex items-center gap-1">
              <span>{zone.emoji}</span>
              <span>{zone.name}</span>
            </p>
          )}
        </div>
        {typeof rating === "number" && (
          <Link
            href="/matchmaking"
            aria-label={`Rating ${rating} — open matchmaking`}
            className="flex-none inline-flex min-h-[44px] items-center"
          >
            <RatingBadge rating={rating} size="sm" />
          </Link>
        )}
      </div>

      {streak > 0 && (
        <div className="flex items-center gap-1.5 -mt-1">
          <FlameIcon className="w-4 h-4 text-premium-gold" />
          <span className="font-classic-body text-xs text-premium-ivory/70">
            {streak}-day streak
          </span>
        </div>
      )}

      {showJourneyRow && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="font-classic-body text-xs text-premium-ivory/60">
              Day {Math.min(currentDay!, totalDays!)} of {totalDays}
            </p>
            <p className="font-classic-body text-xs text-premium-ivory/60">{progressPercent}%</p>
          </div>
          <ProgressBar percent={progressPercent} />
        </div>
      )}
    </div>
  );
}
