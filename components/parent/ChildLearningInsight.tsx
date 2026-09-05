import { TEXT } from "@/lib/designSystem";
import { brainStatusLabel, type ChessBrainView } from "@/lib/learner/chessBrain";

/**
 * "How they're progressing" — the parent-facing read of the same signals the
 * child sees on Chess Mind, so the two never tell different stories.
 *
 * Two deliberate differences from the child's panel:
 *
 *  - It explains its own emptiness. The child's panel hides entirely when
 *    there's no history, so a beginner isn't shown scaffolding implying they
 *    should already have results. A parent looking at a dashboard is asking a
 *    direct question ("is my child learning?"), and silence reads as either a
 *    broken page or a bad answer — so this says what's missing and what
 *    produces it.
 *  - It reports rather than coaches. No practice buttons, no challenges: the
 *    child owns the doing. What a parent needs is an honest picture.
 *
 * Still statuses, never scores — see lib/learner/chessBrain.ts. Every line is
 * tied to a count, because a parent deciding whether this app is worth paying
 * for deserves to see what the claim rests on.
 */
export function ChildLearningInsight({
  view,
  childName,
}: {
  view: ChessBrainView;
  childName: string;
}) {
  const first = childName.trim().split(/\s+/)[0] || childName;

  return (
    <section
      aria-label="Learning progress"
      className="w-full rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <p className={`${TEXT.meta} text-premium-gold`}>How {first} is progressing</p>
        <p className={`${TEXT.caption} normal-case`}>
          From reviewed games and practice — a direction, not a score.
        </p>
      </div>

      {view.isEmpty ? (
        <p className={TEXT.body}>
          Not enough reviewed games yet. Once {first} finishes a game and opens the review, their
          strengths and the skills costing them games will show up here.
        </p>
      ) : (
        <>
          {view.trend === "improving" && (
            <p className="rounded-premiumBtn border border-premium-gold/25 bg-premium-gold/10 px-3 py-2 font-classic-body text-sm text-premium-gold">
              Accuracy is trending up across {first}&apos;s recent games.
            </p>
          )}

          {view.strengths.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
                Going well
              </p>
              {view.strengths.map((r) => (
                <div key={r.skill} className="flex items-start gap-2">
                  <span aria-hidden="true">{r.emoji}</span>
                  <p className={TEXT.body}>
                    <span className="text-premium-ivory">{r.name}</span>
                    <span className="text-premium-ivory/60"> — {brainStatusLabel(r.status).toLowerCase()}. </span>
                    <span className="text-premium-ivory/60">{r.detail}</span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {view.areasToImprove.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
                Finding hard
              </p>
              {view.areasToImprove.map((r) => (
                <div key={r.skill} className="flex items-start gap-2">
                  <span aria-hidden="true">{r.emoji}</span>
                  <p className={TEXT.body}>
                    <span className="text-premium-ivory">{r.name}</span>
                    <span className="text-premium-ivory/60"> — {r.detail}</span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {view.focus && (
            <p className={`${TEXT.caption} normal-case border-t border-white/5 pt-3`}>
              {first} is being pointed at {view.focus.name.toLowerCase()} practice next, in the app.
            </p>
          )}
        </>
      )}
    </section>
  );
}
