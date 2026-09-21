import { ListItemRow } from "@/components/ui/Card";

/**
 * The Tactics Trainer row, factored out of app/(tabs)/play/page.tsx so all
 * three Play mode compositions reuse the same destination (/puzzles/tactics)
 * with only their own copy — same route as the original page, just no
 * longer a one-off inline <Link>.
 */
export function TacticsTrainerRow({ description, className }: { description: string; className?: string }) {
  return (
    <ListItemRow href="/puzzles/tactics" className={`w-full !min-h-[76px] gap-4 px-4 ${className ?? ""}`}>
      <span className="text-2xl" aria-hidden="true">⚔️</span>
      <div className="flex-1 min-w-0">
        <p className="font-classic-body text-[11px] font-semibold text-premium-ivory/50 uppercase tracking-wide">
          Tactics Trainer
        </p>
        <p className="font-classic-display text-base text-premium-ivory">{description}</p>
      </div>
      <span className="text-premium-ivory/40 text-lg" aria-hidden="true">→</span>
    </ListItemRow>
  );
}
