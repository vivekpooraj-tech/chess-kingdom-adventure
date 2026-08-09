export function MoveList({ history }: { history: string[] }) {
  const pairs: [string, string | undefined][] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push([history[i], history[i + 1]]);
  }

  if (pairs.length === 0) {
    return (
      <p className="font-classic-body text-xs text-premium-ivory/30 italic">
        Moves will appear here
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto font-classic-body text-xs">
      {pairs.map(([white, black], i) => (
        <div key={i} className="flex gap-2 text-premium-ivory/70">
          <span className="w-5 text-premium-ivory/30 tabular-nums">{i + 1}.</span>
          <span className="w-14">{white}</span>
          <span className="w-14">{black ?? ""}</span>
        </div>
      ))}
    </div>
  );
}
