import { TEXT } from "@/lib/designSystem";
import type { CompletedGameRecord } from "@/lib/analysis/gameAnalysis";

function formatDuration(startedAt: string, endedAt: string): string | null {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function GameSummaryCard({ record }: { record: CompletedGameRecord }) {
  const resultLabel = record.result.isDraw ? "Draw" : record.result.winner === record.playerColor ? "Win" : "Loss";
  const moveCount = Math.ceil(record.moves.length / 2);
  const duration = formatDuration(record.startedAt, record.endedAt);

  const rows: [string, string][] = [
    ["Result", resultLabel],
    ["You played", record.playerColor === "w" ? "White" : "Black"],
    ["Opponent", record.opponentLabel],
    ["Moves", String(moveCount)],
  ];
  if (record.openingName) rows.push(["Opening", record.openingName]);
  if (duration) rows.push(["Duration", duration]);

  return (
    <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 w-full max-w-md">
      <p className={`${TEXT.meta} text-premium-gold mb-3`}>Game Summary</p>
      <dl className="flex flex-col gap-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <dt className="font-classic-body text-sm text-premium-ivory/50">{label}</dt>
            <dd className="font-classic-body text-sm text-premium-ivory">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
