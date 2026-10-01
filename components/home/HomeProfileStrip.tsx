import Link from "next/link";
import { AvatarOption } from "@/lib/types";
import { FlameIcon } from "@/components/nav/icons";
import { RatingBadge } from "@/components/ui/RatingBadge";

/**
 * Compact profile entry point for Home — avatar, name, streak, and rating
 * without the full HomeHeader card chrome.
 */
export function HomeProfileStrip({
  displayName,
  avatar,
  streak,
  rating,
}: {
  displayName: string;
  avatar: AvatarOption | undefined;
  streak: number;
  rating?: number;
}) {
  return (
    <Link
      href="/profile"
      aria-label={`${displayName} — open profile`}
      className="home-profile-strip flex w-full min-w-0 items-center gap-2.5 rounded-premiumCard border border-white/5 bg-premium-midnight/60 px-3 py-2 shadow-premiumCard transition-[border-color,transform] duration-100 hover:border-premium-gold/20 active:scale-[0.98] sm:w-auto"
    >
      <div
        className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-xl"
        style={{
          background: avatar
            ? `linear-gradient(135deg, ${avatar.colorFrom}, ${avatar.colorTo})`
            : "#28315A",
        }}
      >
        {avatar?.emoji ?? "🧑"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-classic-display text-sm leading-tight text-premium-ivory">
          {displayName}
        </p>
        {streak > 0 && (
          <p className="mt-0.5 flex items-center gap-1 font-classic-body text-[11px] text-premium-ivory/60">
            <FlameIcon className="h-3.5 w-3.5 text-premium-gold" />
            {streak}-day streak
          </p>
        )}
      </div>
      {typeof rating === "number" && (
        <span className="flex-none">
          <RatingBadge rating={rating} size="sm" />
        </span>
      )}
    </Link>
  );
}
