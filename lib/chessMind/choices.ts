/** Builds a shuffled multiple-choice set around a correct numeric answer —
 * distractors are plausible nearby numbers, never negative, never duplicated. */
export function generateChoices(correct: number, count = 4, maxSpread = 4): number[] {
  const choices = new Set<number>([correct]);
  let guard = 0;
  while (choices.size < count && guard < 100) {
    guard++;
    const delta = Math.floor(Math.random() * (maxSpread * 2 + 1)) - maxSpread;
    const candidate = correct + delta;
    if (candidate >= 0 && candidate !== correct) choices.add(candidate);
  }
  return shuffle([...choices]);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
