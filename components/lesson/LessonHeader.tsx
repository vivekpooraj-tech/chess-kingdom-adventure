import Link from "next/link";
import { CloseIcon } from "@/components/nav/icons";
import { TEXT } from "@/lib/designSystem";

/**
 * Compact, consistent header for every step of a lesson (Phase 11 point 2).
 * Deliberately small — the board is the hero, this just orients the child.
 */
export function LessonHeader({
  zoneName,
  zoneEmoji,
  dayNumber,
  title,
  stepIndex,
  totalSteps,
  exitHref = "/kingdom-map",
}: {
  zoneName?: string;
  zoneEmoji?: string;
  dayNumber: number;
  title: string;
  stepIndex: number;
  totalSteps: number;
  exitHref?: string;
}) {
  const progressPercent = Math.round(((stepIndex + 1) / totalSteps) * 100);

  return (
    <div className="w-full max-w-lg flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`${TEXT.meta} text-premium-gold`}>
            {zoneEmoji ? `${zoneEmoji} ` : ""}
            {zoneName ?? "Chess Journey"}
          </p>
          <p className="font-classic-display text-base text-premium-ivory truncate">
            Day {dayNumber} · {title}
          </p>
        </div>
        <Link
          href={exitHref}
          aria-label="Exit lesson"
          className="flex-none w-8 h-8 rounded-full flex items-center justify-center text-premium-ivory/50 hover:text-premium-ivory hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
        >
          <CloseIcon className="w-4 h-4" />
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-premium-goldMuted to-premium-gold transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className={`${TEXT.caption} flex-none`}>
          {stepIndex + 1} of {totalSteps}
        </span>
      </div>
    </div>
  );
}
