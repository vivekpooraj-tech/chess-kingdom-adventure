import type { SchoolSession, SchoolStep } from "@/content/school/types";
import type { WorldId } from "@/lib/world/worlds";

export function schoolArenaTitle(world: WorldId): string {
  if (world === "enchanted") return "Kingdom Learning Journey";
  if (world === "atelier") return "Academy Curriculum";
  return "Classical Chess Study Program";
}

export function schoolArenaKicker(world: WorldId): string {
  if (world === "enchanted") return "Enchanted Kingdom · Chess School";
  if (world === "atelier") return "Master Training Atelier";
  return "Classic Pro · Classical Chess Academy";
}

export function schoolStartLabel(world: WorldId, sessionNumber: number, isFirst: boolean): string {
  if (world === "enchanted") {
    return isFirst ? "Start the journey" : `Continue · Session ${sessionNumber}`;
  }
  if (world === "atelier") {
    return isFirst ? "Start Training" : "Continue Training";
  }
  return isFirst ? "Begin Session" : "Continue Lesson";
}

export function schoolProgressLine(done: number, total: number): string {
  return `${done} of ${total} sessions`;
}

export function firstLessonFen(session: SchoolSession): string | undefined {
  for (const step of session.steps) {
    const fen = fenFromStep(step);
    if (fen) return fen;
  }
  return undefined;
}

export function firstTeachLines(session: SchoolSession): readonly string[] | undefined {
  const teach = session.steps.find((s) => s.type === "teach");
  return teach && teach.type === "teach" ? teach.lines : undefined;
}

function fenFromStep(step: SchoolStep): string | undefined {
  if (step.type === "teach" && step.fen) return step.fen;
  if (step.type === "guided_board") return step.fen;
  if (step.type === "piece_intro") return step.cards[0]?.fen;
  if (step.type === "puzzle_drill" || step.type === "exam") return step.drill.puzzles[0]?.fen;
  if (step.type === "bot_match" && step.fen) return step.fen;
  if (step.type === "parent_mode") return step.beats[0]?.fen;
  return undefined;
}
