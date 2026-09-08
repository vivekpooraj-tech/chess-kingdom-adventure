import type { ChatTurn } from "./types";
import { answerFromKnowledge, classify } from "./knowledge";

/**
 * Ollie's local answer path — used whenever the real model is unavailable
 * (no key configured, a non-OK response, or a thrown error; see
 * lib/ollie/aiProvider.ts, which cannot tell those apart).
 *
 * All the actual knowledge now lives in ./knowledge.ts, which classifies the
 * INTENT of the question first and treats named pieces as one signal among
 * several. This module is just the two things that belong to the conversation
 * rather than to the facts:
 *
 *   1. routing the question through the knowledge layer, and
 *   2. what to say when the knowledge layer honestly does not know.
 *
 * That second part matters more than it looks. The previous version returned
 * one fixed "I'm not sure about that one yet" every single time, so a child who
 * asked three things Ollie didn't know got the same sentence three times and
 * had no idea what he DID know. Ollie still never guesses — an unmatched
 * question never gets an unrelated canned answer — but each successive miss
 * offers a different, concrete way forward.
 */

/**
 * The honest-miss ladder, in order. Each rung says the same true thing ("I
 * don't know that one") and then offers a DIFFERENT next step, so repeated
 * misses in one conversation never repeat themselves word for word.
 *
 * The last rung is sticky: past it, Ollie stops inventing new phrasings and
 * points at a person, which is the right end of this road.
 */
export const FALLBACK_LADDER: readonly string[] = [
  "Hoo! I don't know that one yet 🦉 — but I'm good at how the pieces move, and words like check, checkmate, fork, pin and castling. Try me on one of those?",
  "That one's still outside my nest! Ask me about a piece — knight, bishop, rook, queen, king or pawn — and I'll explain exactly what it does.",
  "Still not one I know, sorry! A Chess School day or a puzzle will teach that better than I can right now — and your teacher or grown-up will know too.",
];

/** True if `text` is one of Ollie's own honest-miss lines. Exported so the
 *  ladder can be recognised in a transcript without string-matching by eye. */
export function isFallbackLine(text: string): boolean {
  return FALLBACK_LADDER.includes(text);
}

/**
 * How many times Ollie has already said "I don't know" in this conversation.
 * Counting from the transcript keeps this function pure — no module-level
 * state that would leak between children or between requests.
 */
function priorMissCount(history: readonly ChatTurn[]): number {
  let count = 0;
  for (const turn of history) {
    if (turn?.from === "buddy" && isFallbackLine(String(turn.text ?? ""))) count++;
  }
  return count;
}

export function localFallbackReply(rawMessage: string, history: ChatTurn[] = []): string {
  const turns = Array.isArray(history) ? history : [];
  const answer = answerFromKnowledge(classify(rawMessage, turns));
  if (answer) return answer.text;

  const rung = Math.min(priorMissCount(turns), FALLBACK_LADDER.length - 1);
  return FALLBACK_LADDER[rung];
}
