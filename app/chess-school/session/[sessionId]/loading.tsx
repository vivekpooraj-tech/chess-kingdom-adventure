/**
 * V1 P1 fix #3 — streamed instantly while page.tsx resolves session content,
 * progress and access server-side (a session can redirect to the classroom
 * if locked, so nothing here can assume the session is even reachable).
 *
 * Deliberately bare — no Screen/TabPageShell — because /chess-school/session
 * itself renders bare (components/nav/navConfig.tsx's FORCE_BARE_PREFIXES):
 * the real page has no tab chrome so its instant-feedback skeleton must not
 * introduce any, or the swap-in would jump. Mirrors SessionRunner's own
 * shape (exit-able header, step-progress dots, one big activity area) with
 * no lesson text, no step count, and no board rendered — none of that exists
 * yet at this point in the request.
 */
import { WorldScope } from "@/components/layout/WorldScope";

export default function ChessSchoolSessionLoading() {
  return (
    <WorldScope>
    <main className="relative mx-auto flex w-full max-w-full flex-col gap-5 px-2 pb-16 pt-4 sm:max-w-xl sm:px-4 md:max-w-2xl lg:max-w-3xl">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-2">
          <div className="h-5 w-28 rounded-full bg-premium-navy/70 animate-pulse" />
          <div className="h-7 w-56 rounded bg-premium-navy/70 animate-pulse" />
        </div>
        <div className="h-10 w-10 flex-none rounded-full bg-premium-navy/60 animate-pulse" />
      </header>

      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="h-1 flex-1 rounded-full bg-white/10 animate-pulse" />
        ))}
      </div>

      <p className="font-classic-body text-sm text-premium-ivory/40" role="status">
        Loading your session…
      </p>

      <div className="mx-auto aspect-square w-full max-w-full rounded-premiumCard bg-premium-navy animate-pulse [width:min(calc(100vw-1rem),calc(100vw-env(safe-area-inset-left,0px)-env(safe-area-inset-right,0px)-1rem),88dvh,720px)] md:[width:min(calc(100vw-2rem),min(72dvh,600px),640px)] lg:[width:min(100%,min(68dvh,640px),720px)]" />

      <div className="h-14 w-full rounded-premiumBtn bg-premium-navy/60 animate-pulse" />
    </main>
    </WorldScope>
  );
}
