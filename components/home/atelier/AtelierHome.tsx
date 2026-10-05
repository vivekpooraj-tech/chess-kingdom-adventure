import Link from "next/link";
import { ChessBoard } from "@/components/board/ChessBoard";
import { TeachingOverlay } from "@/components/board/TeachingOverlay";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { DailyQuestsCard } from "@/components/home/DailyQuestsCard";
import { AtelierForm, AtelierGreeting, AtelierMomentum } from "@/components/home/atelier/AtelierLive";
import { getSessionById } from "@/content/school/sessions";
import { getCourse } from "@/lib/academy/courses.server";
import type { PrimaryAction } from "@/lib/home/getPrimaryAction";
import type { DailyQuestSet } from "@/lib/quests/dailyQuests";

/**
 * Master Training Atelier Home — the approved editorial layout:
 * greeting · current training · your form · train next · training lab · today's challenge · momentum.
 *
 * Presentation only. Every value is something Home already loads (the child row, the primary action,
 * the skill-focus recommendation, per-category solved counts, opening encounters, daily quests) or a
 * small client island that reads the same tables the other worlds read (AtelierLive). Nothing is invented:
 * when a figure is not available it shows "—" or the section is omitted.
 *
 * Only rendered in the Atelier world (WorldBranch); Enchanted Kingdom and Classic Pro are untouched.
 */

type Focus = { skillName: string; weakCount: number; href: string } | null;

const pad2 = (n: number) => String(n).padStart(2, "0");

type Preview = {
  fen: string;
  squares: string[];
  arrows: { from: string; to: string }[];
  caption: string;
};

/**
 * The real teaching position of the session the child is about to open: the first step of that session that
 * carries a board (guided board, piece introduction or a teach step with a position), with the very squares
 * and arrows the lesson itself highlights. Nothing is composed here — it is the lesson's own content, shown
 * read-only. Returns null when the session has no board step (the hero then shows a purely decorative grid).
 */
function sessionPreview(action: PrimaryAction): Preview | null {
  if (action.kind !== "school") return null;
  const session = getSessionById(action.href.split("/").pop() ?? "");
  if (!session) return null;
  for (const step of session.steps) {
    if (step.type === "guided_board") {
      return {
        fen: step.fen,
        squares: [...(step.highlightSquares ?? [])],
        arrows: (step.arrows ?? []).map((a) => ({ from: a.from, to: a.to })),
        caption: step.title,
      };
    }
    if (step.type === "piece_intro" && step.cards[0]) {
      const c = step.cards[0];
      return { fen: c.fen, squares: [...c.highlightSquares], arrows: c.arrows.map((a) => ({ from: a.from, to: a.to })), caption: c.name };
    }
    if (step.type === "teach" && step.fen) {
      return { fen: step.fen, squares: [], arrows: [], caption: step.title };
    }
  }
  return null;
}

/** The categories the lab showcases, in the approved asymmetric order, with the page each opens. */
const LAB = [
  { id: "pattern", eyebrow: "Tactics", title: "Tactical Acuity", note: "See tactical patterns faster.", href: "/chess-mind/pattern", module: "pattern" },
  { id: "spatial", eyebrow: "Geometry", title: "Spatial Architecture", note: "Understand board geometry.", href: "/chess-mind/spatial", module: "spatial" },
  { id: "openings", eyebrow: "Openings", title: "Opening Trees", note: "28 named openings, principles, and how to choose one.", href: "/academy/openings", module: null },
  { id: "strategy", eyebrow: "Strategy", title: "Strategic Levers", note: "Outposts, pawn breaks, king safety, and how to form a plan.", href: "/academy/strategy", module: null },
  { id: "reaction", eyebrow: "Speed", title: "Intuitive Velocity", note: "Recognize threats faster.", href: "/chess-mind/reaction", module: "reaction" },
] as const;

function currentTraining(action: PrimaryAction): {
  eyebrow: string;
  numeral: string | null;
  title: string;
  subtitle: string;
  href: string;
  cta: string;
  progress: { have: number; total: number } | null;
} {
  switch (action.kind) {
    case "school":
      return {
        eyebrow: "Current training",
        numeral: pad2(action.sessionNumber),
        title: action.title,
        subtitle: action.subtitle,
        href: action.href,
        cta: action.isFirstSession ? "Start training" : "Continue training",
        progress: { have: action.startedCount, total: action.totalSessions },
      };
    case "focus":
      return {
        eyebrow: "Skill focus",
        numeral: null,
        title: action.skillName,
        subtitle: `It came up in ${action.weakCount} of your reviewed games. Let’s work on it.`,
        href: action.href,
        cta: `Work on ${action.skillName}`,
        progress: null,
      };
    case "practice":
      return { eyebrow: "Tactical drill", numeral: null, title: "Sharpen your skills with a fresh puzzle.", subtitle: "", href: "/puzzles", cta: "Train tactics", progress: null };
    case "puzzles":
      return { eyebrow: "Recommended", numeral: null, title: action.title, subtitle: action.subtitle, href: "/puzzles", cta: "Open tactics", progress: null };
    case "academy":
      return { eyebrow: "Academy", numeral: null, title: action.title, subtitle: action.subtitle, href: action.href, cta: "Start training", progress: null };
    default:
      return { eyebrow: "Play", numeral: null, title: action.title, subtitle: action.subtitle, href: "/play", cta: "Play now", progress: null };
  }
}

export function AtelierHome({
  childId,
  displayName,
  rating,
  streak,
  totalSolved,
  statsByModule,
  openingCount,
  primaryAction,
  focus,
  questSet,
  neutralTone,
}: {
  childId: string;
  displayName: string;
  rating: number | null;
  streak: number;
  totalSolved: number;
  statsByModule: Record<string, number>;
  openingCount: number;
  primaryAction: PrimaryAction;
  focus: Focus;
  questSet: DailyQuestSet;
  neutralTone: boolean;
}) {
  const training = currentTraining(primaryAction);
  const preview = sessionPreview(primaryAction);
  // Strategic Levers has no per-child solved count, so it shows a real fact about the course instead.
  const strategyLessons = getCourse("strategy")?.lessons.length ?? null;
  const firstName = displayName.trim().split(/\s+/)[0] || displayName;
  const percent = training.progress ? Math.round((training.progress.have / training.progress.total) * 100) : 0;

  // "Train next": a real recurring weakness if there is one; otherwise the Chess Mind category practised least.
  const leastPracticed = LAB.filter((l) => l.module)
    .map((l) => ({ ...l, solved: statsByModule[l.module as string] ?? 0 }))
    .sort((a, b) => a.solved - b.solved)[0];

  return (
    <div className="at-home">
      <header className="at-top world-enter">
        <div className="min-w-0">
          <p className="at-eyebrow at-eyebrow--accent">Master Training Atelier</p>
          <AtelierGreeting name={firstName} />
          <p className="at-sub">
            {streak > 0 ? `${streak}-day training streak` : "Start a training streak today"} · {totalSolved} Chess Mind exercise
            {totalSolved === 1 ? "" : "s"} solved
          </p>
        </div>
        <Link href={training.href} className="at-focuschip">
          <span className="at-eyebrow">Current focus</span>
          <strong>{focus ? focus.skillName : training.title}</strong>
        </Link>
      </header>

      <div className="at-grid at-grid--top world-enter world-enter-delay-1">
        <section className="at-card at-hero" aria-labelledby="at-hero-title">
          <div className="at-hero__main">
          <p className="at-eyebrow">{training.eyebrow}</p>
          <div className="at-hero__title">
            {training.numeral && (
              <span className="at-hero__numeral" aria-hidden="true">
                {training.numeral}
              </span>
            )}
            <h2 id="at-hero-title" className="at-display">
              {training.numeral && <span className="sr-only">Session {training.numeral}: </span>}
              {training.title}
            </h2>
          </div>
          {training.subtitle && <p className="at-hero__sub">{training.subtitle}</p>}
          {training.progress && (
            <div className="at-progress">
              <div
                role="progressbar"
                aria-valuenow={training.progress.have}
                aria-valuemin={0}
                aria-valuemax={training.progress.total}
                aria-label={`Chess School: ${training.progress.have} of ${training.progress.total} sessions complete`}
                className="at-progress__bar"
              >
                <div className="at-progress__fill" style={{ width: `${percent}%` }} />
              </div>
              <p className="at-progress__label">
                <span>Course progress</span>
                <span>
                  {training.progress.have} / {training.progress.total} sessions
                </span>
              </p>
            </div>
          )}
          <div className="at-hero__actions">
            <Link href={training.href} className="at-cta">
              {training.cta} <span aria-hidden="true">→</span>
            </Link>
            <Link href="/chess-school" className="at-link">
              View the course
            </Link>
          </div>
          </div>
          {preview ? (
            <figure className="at-hero__visual at-hero__visual--board">
              <div className="at-hero__boardwrap" aria-hidden="true">
                <div className="at-hero__boardscale">
                  <ChessBoard
                    fen={preview.fen}
                    readOnly
                    focusMode
                    size={300}
                    boardOverlay={<TeachingOverlay squares={preview.squares} arrows={preview.arrows} pulse={false} />}
                  />
                </div>
              </div>
              <figcaption className="at-eyebrow">Next on the board · {preview.caption}</figcaption>
            </figure>
          ) : (
            <div className="at-hero__visual at-hero__visual--grid" aria-hidden="true" />
          )}
        </section>

        <div className="at-side">
          <AtelierForm childId={childId} rating={rating} />

          <section className="at-card at-next" aria-labelledby="at-next-title">
            <p className="at-eyebrow at-eyebrow--oxblood">Train next</p>
            {focus ? (
              <>
                <h2 id="at-next-title" className="at-h2">{focus.skillName} needs the next rep.</h2>
                <p className="at-note">It came up in {focus.weakCount} of your reviewed games.</p>
                <Link href={focus.href} className="at-cta at-cta--oxblood">
                  Work on {focus.skillName} <span aria-hidden="true">→</span>
                </Link>
              </>
            ) : (
              <>
                <h2 id="at-next-title" className="at-h2">{leastPracticed.title} is your quietest area.</h2>
                <p className="at-note">
                  {leastPracticed.solved === 0 ? "Not started yet." : `${leastPracticed.solved} solved so far.`} A short session keeps the
                  whole picture balanced.
                </p>
                <Link href={leastPracticed.href} className="at-cta at-cta--oxblood">
                  Train {leastPracticed.title} <span aria-hidden="true">→</span>
                </Link>
              </>
            )}
          </section>
        </div>
      </div>

      <section className="at-lab world-enter world-enter-delay-2" aria-labelledby="at-lab-title">
        <div className="at-lab__head">
          <div>
            <p className="at-eyebrow at-eyebrow--accent">Skill studios</p>
            <h2 id="at-lab-title" className="at-display at-display--sm">Training lab</h2>
          </div>
          <Link href="/chess-mind" className="at-link">All training</Link>
        </div>
        <div className="at-lab__grid">
          {LAB.map((l) => {
            const count =
              l.module !== null
                ? statsByModule[l.module] ?? 0
                : l.id === "openings"
                  ? openingCount
                  : l.id === "strategy"
                    ? strategyLessons
                    : null;
            const countLabel =
              l.module !== null ? "solved" : l.id === "openings" ? "openings met" : l.id === "strategy" ? "lessons in the course" : null;
            return (
              <Link key={l.id} href={l.href} className={`at-card at-lab__card at-lab__card--${l.id}`}>
                <span className="at-eyebrow">{l.eyebrow}</span>
                <span className="at-h2">{l.title}</span>
                <span className="at-note">{l.note}</span>
                <span className="at-lab__foot">
                  {count !== null && countLabel ? (
                    <span className="at-lab__count">
                      <strong>{count}</strong> {countLabel}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="at-lab__go">
                    Open <span aria-hidden="true">→</span>
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="at-grid at-grid--bottom world-enter world-enter-delay-2">
        <section className="at-card at-today" aria-labelledby="at-today-title">
          <p className="at-eyebrow at-eyebrow--accent">Today</p>
          <h2 id="at-today-title" className="at-h2">Today&rsquo;s challenge</h2>
          <DailyChallengeCard childId={childId} variant="atelier" />
          <DailyQuestsCard set={questSet} neutralTone={neutralTone} embedded />
        </section>
        <AtelierMomentum childId={childId} streak={streak} />
      </div>
    </div>
  );
}
