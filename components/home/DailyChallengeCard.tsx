import Link from "next/link";
import { ChessPuzzle } from "@/lib/types";

export function DailyChallengeCard({ puzzle }: { puzzle: ChessPuzzle }) {
  return (
    <Link
      href="/puzzles"
      className="w-full max-w-md rounded-premiumCard bg-premium-ivory p-5 flex items-center gap-4 shadow-premiumCard border border-premium-gold/20"
    >
      <div className="w-12 h-12 rounded-full bg-premium-midnight flex items-center justify-center text-xl flex-none">
        ♟️
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-classic-body text-[10px] uppercase tracking-wider text-premium-goldMuted font-semibold">
          Daily Challenge
        </p>
        <p className="font-classic-display text-base text-premium-midnight truncate">
          {puzzle.theme} — Mate in {puzzle.mateIn}
        </p>
      </div>
      <span className="font-classic-body text-xs font-semibold text-premium-midnight border border-premium-midnight/30 rounded-full px-3 py-1.5 flex-none">
        Solve →
      </span>
    </Link>
  );
}
