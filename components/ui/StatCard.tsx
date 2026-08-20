/**
 * Chess Mind design system — StatCard. Replaces the StatTile pattern that
 * was independently redefined in app/profile/page.tsx and app/kingdom-map/
 * page.tsx (same visual intent, two separate implementations) with one
 * shared component so a stats row looks identical everywhere it appears.
 */
export function StatCard({
  emoji,
  value,
  label,
}: {
  emoji?: string;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-4 flex flex-col gap-1 min-h-[76px] justify-center">
      {emoji && <span className="text-xl leading-none">{emoji}</span>}
      <p className="font-classic-display text-2xl text-premium-ivory leading-tight">{value}</p>
      <p className="font-classic-body text-[11px] text-premium-ivory/50 leading-tight">{label}</p>
    </div>
  );
}

/** Compact variant for a dense inline row (e.g. inside a card, not its own grid cell). */
export function StatCardCompact({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center text-center min-w-[44px]">
      <p className="font-classic-display text-base text-premium-ivory">{value}</p>
      <p className="font-classic-body text-[9px] text-premium-ivory/50 uppercase tracking-wide">{label}</p>
    </div>
  );
}
