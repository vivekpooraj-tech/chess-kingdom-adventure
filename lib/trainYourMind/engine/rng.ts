import { fnv1a } from "../exerciseIds";

/**
 * Deterministic randomness for exercise construction.
 *
 * An exercise is a pure function of its id: the same id always builds the same
 * choices in the same order. That keeps "no hidden state" true (the answer key
 * can always be recomputed), makes exercises testable, and means the stable id
 * used for per-child history can never drift because of shuffling.
 */
export function seededRng(seed: string): () => number {
  let a = parseInt(fnv1a(seed), 36) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface ChoiceSet {
  choices: string[];
  correctIndex: number;
}

/**
 * Build a shuffled choice list around one correct answer. Returns null if there
 * are not enough DISTINCT distractors — callers then skip the exercise rather
 * than show a degenerate question.
 */
export function makeChoiceSet(
  correct: string,
  distractors: readonly string[],
  seed: string,
  size = 4
): ChoiceSet | null {
  const rng = seededRng(seed + "|choices");
  const unique = [...new Set(distractors.filter((d) => d !== correct))];
  if (unique.length < size - 1) return null;
  const picked = seededShuffle(unique, rng).slice(0, size - 1);
  const all = seededShuffle([correct, ...picked], rng);
  return { choices: all, correctIndex: all.indexOf(correct) };
}

/** Pick `n` items deterministically. */
export function seededPick<T>(items: readonly T[], n: number, seed: string): T[] {
  return seededShuffle(items, seededRng(seed + "|pick")).slice(0, n);
}
