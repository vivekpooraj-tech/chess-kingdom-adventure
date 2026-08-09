import Link from "next/link";
import { OpeningMatch } from "@/lib/openings/recognitionEngine";
import { Button } from "@/components/ui/Button";

/** Shown once a game ends, if an opening was recognized during it — a
 * simple recap, not a new detection (recognition already happened live via
 * lib/openings/recognitionEngine.ts). */
export function GameEndOpeningSummary({ match }: { match: OpeningMatch }) {
  const { opening } = match;

  return (
    <div className="w-full max-w-sm rounded-premiumCard bg-premium-navy border border-premium-gold/20 shadow-premiumCard p-5 flex flex-col items-center gap-2 text-center">
      <p className="font-classic-body text-[10px] uppercase tracking-wider text-premium-ivory/40">
        Opening Detected
      </p>
      <p className="font-classic-display text-lg text-premium-gold">{opening.name}</p>
      <div className="flex items-center gap-2">
        <span className="font-classic-body text-xs text-premium-ivory/40">{opening.ecoCode}</span>
        {match.isGambit && (
          <span className="font-classic-body text-[9px] font-semibold text-red-300 border border-red-400/30 rounded-full px-1.5 py-0.5">
            GAMBIT
          </span>
        )}
      </div>
      <p className="font-classic-body text-xs text-premium-ivory/60">
        Your game began with the {opening.name}.
      </p>
      <p className="font-classic-body text-xs text-premium-ivory/50">{opening.description}</p>
      <Link href={`/academy/openings/${opening.id}`} className="mt-2">
        <Button variant="ghost">Study this opening →</Button>
      </Link>
    </div>
  );
}
