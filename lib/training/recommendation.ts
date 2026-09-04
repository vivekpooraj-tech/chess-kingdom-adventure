import { PUZZLES } from "@/content/puzzles";
import { PATTERN_CHALLENGES } from "@/content/chessMindPatterns";
import { TACTICS_LESSONS } from "@/content/tacticsLessons";
import type { ExperienceLevel, AgeBand } from "@/lib/learner/experienceLevel";
import { effectiveExperienceLevel } from "@/lib/learner/experienceLevel";
import { getSkill, type SkillId } from "@/lib/analysis/skills";

/**
 * Personalized practice recommendation for a reviewed-game skill.
 *
 * Rules (per the brief):
 *  - Reuse existing content ONLY. No puzzle is invented; content/puzzles.ts
 *    is not touched.
 *  - Prefer real board practice (a position the child solves) when the
 *    skill has genuinely appropriate positions.
 *  - When it doesn't, route to the matching existing Academy lesson rather
 *    than pretending a puzzle exists — and say so honestly (`coverageNote`).
 *  - 3–5 activities when available; fewer if fewer genuinely fit. Never pad.
 *
 * The embedded board runner (components/game/analysis/SkillPracticeSet.tsx)
 * can verify exactly two kinds of position without an engine:
 *   - "checkmate": any move that mates (mate-in-1 puzzles from the library)
 *   - "fork" / "hanging" / "check": the semantic checks
 *     lib/chessMind/patternVerification.ts already uses for /chess-mind/pattern
 * Anything deeper (mate-in-2/3, pins-by-choice, multi-move calculation) is
 * offered as a lesson link, not faked as a one-move puzzle.
 */

export type PracticeCheck =
  | { type: "checkmate" }
  | { type: "fork" }
  | { type: "hanging" }
  | { type: "check" };

export interface PracticeBoardItem {
  kind: "board";
  id: string;
  fen: string;
  /** Side the child plays in this position. */
  playerColor: "w" | "b";
  prompt: string;
  check: PracticeCheck;
  /** e.g. "Back-Rank Mate" / "Knight Fork" — shown as a small label. */
  sourceLabel: string;
}

export interface PracticeLessonItem {
  kind: "lesson";
  id: string;
  title: string;
  description: string;
  href: string;
}

export type PracticeItem = PracticeBoardItem | PracticeLessonItem;

export interface PracticeRecommendation {
  skill: SkillId;
  headline: string;
  subhead: string;
  items: PracticeItem[];
  /** Non-null when the skill has thin/no dedicated puzzle content — shown
   * to the child/parent so the routing is honest. */
  coverageNote: string | null;
}

export interface RecommendPracticeInput {
  skill: SkillId;
  experienceLevel: ExperienceLevel | null;
  ageBand?: AgeBand | null;
  solvedPuzzleIds?: ReadonlySet<string>;
}

/** Deterministic-ish shuffle so a review re-opened in the same session
 * gives the same practice set (seed from the skill + count). */
function seededPick<T>(arr: readonly T[], count: number, seedStr: string): T[] {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const pool = [...arr];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    out.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return out;
}

/** Mate-in-1 difficulty band from experience level (puzzle `level` is 1–5). */
function mateLevelBand(level: ExperienceLevel): [number, number] {
  if (level === "plays_regularly") return [1, 4];
  if (level === "knows_basics") return [1, 3];
  return [1, 2];
}

function mateInOneItems(
  count: number,
  band: [number, number],
  solved: ReadonlySet<string>,
  prompt: (side: "White" | "Black") => string,
  seedStr: string
): PracticeBoardItem[] {
  const eligible = PUZZLES.filter(
    (p) => p.mateIn === 1 && p.level >= band[0] && p.level <= band[1] && !solved.has(p.id)
  );
  // If experience filtering + solved exclusion leaves too few, widen.
  const pool = eligible.length >= count ? eligible : PUZZLES.filter((p) => p.mateIn === 1 && !solved.has(p.id));
  const finalPool = pool.length >= count ? pool : PUZZLES.filter((p) => p.mateIn === 1);
  return seededPick(finalPool, count, seedStr).map((p) => ({
    kind: "board" as const,
    id: `puzzle:${p.id}`,
    fen: p.fen,
    playerColor: p.sideToMove,
    prompt: prompt(p.sideToMove === "w" ? "White" : "Black"),
    check: { type: "checkmate" as const },
    sourceLabel: p.theme,
  }));
}

function patternItems(
  type: "fork" | "hanging" | "check",
  prompt: string
): PracticeBoardItem[] {
  return PATTERN_CHALLENGES.filter((c) => c.type === type).map((c) => {
    const side: "w" | "b" = c.fen.split(" ")[1] === "b" ? "b" : "w";
    return {
      kind: "board" as const,
      id: `pattern:${c.id}`,
      fen: c.fen,
      playerColor: side,
      prompt: c.prompt || prompt,
      check: { type } as PracticeCheck,
      sourceLabel: type === "hanging" ? "Hanging Piece" : type === "fork" ? "Knight Fork" : "Check",
    };
  });
}

function tacticsLesson(id: string): PracticeLessonItem | null {
  const lesson = TACTICS_LESSONS.find((l) => l.id === id);
  if (!lesson) return null;
  return {
    kind: "lesson",
    id: `tactics:${lesson.id}`,
    title: `Academy: ${lesson.title}`,
    description: "A short Academy lesson — learn it, see it, then practice it.",
    href: `/academy/tactics/${lesson.id}`,
  };
}

const CALCULATION_LESSON: PracticeLessonItem = {
  kind: "lesson",
  id: "chessmind:calculation",
  title: "Chess Mind: Calculation",
  description: "Practice looking a few moves ahead before you decide.",
  href: "/chess-mind/calculation",
};

const OPENINGS_LESSON: PracticeLessonItem = {
  kind: "lesson",
  id: "academy:openings",
  title: "Academy: Opening Explorer",
  description: "See how strong openings develop pieces and fight for the centre.",
  href: "/academy/openings",
};

const FUNDAMENTALS_LESSON: PracticeLessonItem = {
  kind: "lesson",
  id: "academy:fundamentals",
  title: "Academy: Fundamentals",
  description: "Revisit the building blocks — check, checkmate, castling and more.",
  href: "/academy/fundamentals",
};

/**
 * Skill → practice plan. Every branch returns real, existing content.
 */
export function recommendPractice(input: RecommendPracticeInput): PracticeRecommendation {
  const level = effectiveExperienceLevel(input.experienceLevel);
  const solved = input.solvedPuzzleIds ?? new Set<string>();
  const band = mateLevelBand(level);
  const info = getSkill(input.skill);
  const base = {
    skill: input.skill,
    headline: `Practice ${info.name}`,
    subhead: "Let's strengthen this skill.",
  };

  switch (input.skill) {
    case "piece_safety":
    case "captures":
    case "threats": {
      const items: PracticeItem[] = [
        ...patternItems("hanging", "Find and win the undefended piece."),
      ];
      const lesson = tacticsLesson("checks-captures-threats");
      if (lesson) items.push(lesson);
      // Top up with "spot the mate" — same "scan the whole board" habit.
      items.push(
        ...mateInOneItems(
          Math.max(0, 4 - items.length),
          band,
          solved,
          (s) => `${s} to move. Look at the whole board — is there a checkmate?`,
          `${input.skill}-topup`
        )
      );
      return {
        ...base,
        items: items.slice(0, 5),
        coverageNote:
          "Chess Mind has a small set of dedicated piece-safety positions — we've added some tactical spotting practice too.",
      };
    }

    case "forks": {
      const items: PracticeItem[] = [...patternItems("fork", "Find the knight fork.")];
      const lesson = tacticsLesson("forks");
      if (lesson) items.push(lesson);
      return {
        ...base,
        items,
        coverageNote:
          items.filter((i) => i.kind === "board").length < 3
            ? "Only a couple of dedicated fork positions exist yet — the Academy lesson covers the rest."
            : null,
      };
    }

    case "pins":
      return {
        ...base,
        items: [tacticsLesson("pins")].filter((x): x is PracticeLessonItem => !!x),
        coverageNote:
          "Pin practice lives in the Academy — it's a recognise-the-pattern lesson, not a one-move puzzle.",
      };

    case "skewers":
      return {
        ...base,
        items: [tacticsLesson("skewers")].filter((x): x is PracticeLessonItem => !!x),
        coverageNote: "Skewer practice is an Academy lesson for now.",
      };

    case "discovered_attacks":
      return {
        ...base,
        items: [tacticsLesson("discovered-attacks"), tacticsLesson("discovered-check")].filter(
          (x): x is PracticeLessonItem => !!x
        ),
        coverageNote: "Discovered-attack practice is an Academy lesson for now.",
      };

    case "checks": {
      const items: PracticeItem[] = [...patternItems("check", "Give check!")];
      items.push(
        ...mateInOneItems(
          Math.max(0, 4 - items.length),
          band,
          solved,
          (s) => `${s} to move. Find the checking move that ends the game.`,
          "checks"
        )
      );
      return { ...base, items: items.slice(0, 5), coverageNote: null };
    }

    case "tactical_awareness":
    case "advantage_loss": {
      const items = mateInOneItems(
        4,
        band,
        solved,
        (s) => `${s} to move. Scan for checks and captures — find the checkmate.`,
        input.skill
      );
      const lesson = tacticsLesson("tactical-vision");
      const all: PracticeItem[] = [...items];
      if (lesson) all.push(lesson);
      return {
        ...base,
        headline: input.skill === "advantage_loss" ? "Practice: Staying Alert" : base.headline,
        items: all.slice(0, 5),
        coverageNote: null,
      };
    }

    case "calculation": {
      const items = mateInOneItems(
        3,
        band,
        solved,
        (s) => `${s} to move. Picture the position first, then play the mate.`,
        "calculation"
      );
      return {
        ...base,
        items: [...items, CALCULATION_LESSON],
        coverageNote:
          "Deeper multi-move calculation practice lives in Chess Mind → Calculation.",
      };
    }

    case "endgame": {
      // The mate-pattern library IS basic endgame technique (K+Q, K+R…).
      const endgameThemes = new Set([
        "King & Rook Mate",
        "Queen & King",
        "Cornered King",
        "Rook Box Mate",
        "Corridor Mate",
        "Queen Mating Net",
        "Rook Ladder",
        "Corner Mate",
      ]);
      const eligible = PUZZLES.filter(
        (p) => p.mateIn <= 2 && endgameThemes.has(p.theme) && !solved.has(p.id)
      );
      const pool = eligible.length >= 3 ? eligible : PUZZLES.filter((p) => p.mateIn === 1 && endgameThemes.has(p.theme));
      const items: PracticeItem[] = seededPick(pool, 4, "endgame")
        .filter((p) => p.mateIn === 1)
        .map((p) => ({
          kind: "board" as const,
          id: `puzzle:${p.id}`,
          fen: p.fen,
          playerColor: p.sideToMove,
          prompt: `${p.sideToMove === "w" ? "White" : "Black"} to move. Finish the king off — checkmate.`,
          check: { type: "checkmate" as const },
          sourceLabel: p.theme,
        }));
      return {
        ...base,
        items: items.length > 0 ? items : mateInOneItems(3, band, solved, (s) => `${s} to move. Checkmate.`, "endgame2"),
        coverageNote:
          "Chess Mind doesn't have a full endgame trainer yet — these are the basic king-and-piece mates.",
      };
    }

    case "king_safety":
      return {
        ...base,
        items: [tacticsLesson("back-rank-tactics"), FUNDAMENTALS_LESSON].filter(
          (x): x is PracticeLessonItem => !!x
        ),
        coverageNote: "King-safety practice is an Academy lesson for now.",
      };

    case "opening_principles":
    case "development":
    case "center_control":
      return {
        ...base,
        items: [OPENINGS_LESSON],
        coverageNote:
          "Chess Mind doesn't have opening puzzles — the Opening Explorer is the best place to practice this.",
      };

    case "pawn_structure":
      return {
        ...base,
        items: [FUNDAMENTALS_LESSON],
        coverageNote: "There's no dedicated pawn-structure trainer yet — the fundamentals are a good refresher.",
      };

    default:
      return {
        ...base,
        items: mateInOneItems(3, band, solved, (s) => `${s} to move. Find the checkmate.`, "default"),
        coverageNote: null,
      };
  }
}
