import type { WorldId } from "@/lib/world/worlds";
import type { Difficulty } from "@/lib/chess-engine/stockfishEngine";

const PROTOCOL: Record<Difficulty, string> = {
  "very-easy": "01",
  easy: "02",
  medium: "03",
  hard: "04",
};

export function playArenaTitle(world: WorldId, fallback: string): string {
  if (world === "enchanted") return "Quest Trial";
  if (world === "atelier") return "Atelier Sparring Console";
  if (fallback.startsWith("Tournament")) return fallback;
  return "Championship Match Chamber";
}

export function protocolForDifficulty(difficulty: Difficulty | undefined): string {
  if (!difficulty) return "—";
  return PROTOCOL[difficulty] ?? "—";
}

/** Honest session figures — never a fabricated engine accuracy. */
export function sessionFigures(historyLength: number, capturedCount: number, startedAt?: string) {
  const plyDepth = historyLength;
  const movePairs = Math.ceil(historyLength / 2);
  let elapsed = "—";
  if (startedAt) {
    const ms = Date.now() - Date.parse(startedAt);
    if (Number.isFinite(ms) && ms >= 0) {
      const s = Math.floor(ms / 1000);
      elapsed = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }
  }
  return { plyDepth, movePairs, capturedCount, elapsed };
}

export const QUEST_CHAMBERS = ["Gate", "Hall", "Keep", "Tower", "Crown"] as const;
