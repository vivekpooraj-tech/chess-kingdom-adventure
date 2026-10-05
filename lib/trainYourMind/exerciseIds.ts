/**
 * Stable exercise ids for Train Your Chess Mind history.
 *
 * Deterministic (same content -> same id on every device/session) and compact.
 * Static content uses its own authored id; generated drills hash the real
 * content (position + question text), so two devices that generate the same
 * question agree it is the same exercise. FNV-1a 32-bit is plenty here: ids
 * are scoped per child + module and only ever compared within that set.
 */

export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Authored static exercise (Pattern, Calculation). */
export function staticExerciseId(authoredId: string): string {
  return `s:${authoredId}`;
}

/** Generated exercise: a position (optional) plus the actual question text. */
export function generatedExerciseId(kind: string, fen: string | null, prompt: string): string {
  return `g:${kind}:${fen ? fnv1a(fen) : "-"}:${fnv1a(prompt)}`;
}

/** Server-library tactic puzzle (Reaction). */
export function libraryPuzzleExerciseId(puzzleId: string): string {
  return `p:${puzzleId}`;
}
