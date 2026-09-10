"use client";

import Link from "next/link";
import { TEXT } from "@/lib/designSystem";
import { ACTIVITY_ROUTE_PREFIXES, CHESS_TIME_ACTIVITIES } from "@/lib/parentLock/activities";
import type { ChessTimeActivityId } from "@/lib/parentLock/types";
import { useChessTime } from "./ChessTimeProvider";

const ACTIVITY_ENTRY: Record<ChessTimeActivityId, string> = {
  chess_school: "/chess-school",
  play: "/play",
  puzzles: "/puzzles",
  world: "/world",
  academy: "/learn",
};

export function ChessTimeActivityLinks() {
  const { session } = useChessTime();
  if (!session?.active) return null;

  const allowed = new Set(session.allowedActivities);

  return (
    <div className="grid gap-3 sm:grid-cols-2 w-full">
      {CHESS_TIME_ACTIVITIES.filter((a) => allowed.has(a.id)).map((activity) => (
        <Link
          key={activity.id}
          href={ACTIVITY_ENTRY[activity.id]}
          className="rounded-premiumCard bg-premium-navy border border-white/10 p-4 flex items-center gap-3 hover:border-premium-gold/30 active:scale-[0.98] transition-transform"
        >
          <span className="text-3xl">{activity.emoji}</span>
          <div className="min-w-0">
            <p className="font-classic-display text-base text-premium-ivory">{activity.label}</p>
            <p className={`${TEXT.caption} normal-case`}>{activity.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

/** For tests / docs — maps activity to first route prefix. */
export function activityRoutePrefixes(id: ChessTimeActivityId): readonly string[] {
  return ACTIVITY_ROUTE_PREFIXES[id];
}
