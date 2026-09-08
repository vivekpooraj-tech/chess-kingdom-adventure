/**
 * What Ollie's voice actually says.
 *
 * Pure text in, pure text out — no browser, no speech API, no clock. Every
 * rule here is testable, which matters because narration is the one part of
 * the app a child may experience WITHOUT reading: a sentence that comes out
 * wrong cannot be silently skimmed past.
 *
 * Two registers, and they differ in WORDS, not just in voice settings:
 *
 *   child  "The knight moves in an L shape. Two squares, then one to the side."
 *   adult  "The knight moves two squares in one direction, then one square
 *           perpendicular."
 *
 * Both are true. The child version is shorter, concrete and warm; the adult
 * version is precise. Neither is a translation of the other, and neither
 * invents a chess fact the screen does not also state.
 */
import type { VoiceRegister } from "./types";

/**
 * Speech synthesis reads punctuation and symbols literally, so raw UI copy is
 * unusable: "👑" becomes "crown", "→" becomes nothing or "right arrow"
 * depending on the engine, "Day 12 · The Knight" becomes "Day 12 middle dot
 * The Knight". This strips what should not be heard and leaves the sentence.
 *
 * Deliberately conservative — it removes decoration, never words.
 */
export function sanitizeForSpeech(raw: string): string {
  return String(raw ?? "")
    // Emoji and pictographs.
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, " ")
    // Separators used as visual punctuation.
    .replace(/[·•|]/g, " ")
    // Markdown emphasis, which is never spoken.
    .replace(/[*_`#]/g, "")
    // An em dash reads better as a pause than as a word.
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

/**
 * Web Speech engines truncate or stall on very long utterances — the limit is
 * unspecified and differs per browser, and a cut-off sentence is worse than a
 * pause. Split on sentence boundaries, never mid-word.
 *
 * A single sentence longer than the limit is emitted whole rather than
 * chopped: a hard break inside a clause is more damaging than a long one.
 */
export function chunkForSpeech(text: string, maxChars = 200): string[] {
  const clean = sanitizeForSpeech(text);
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const sentences = clean.match(/[^.!?]+[.!?]*\s*/g) ?? [clean];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;
    if (!current) {
      current = piece;
    } else if (current.length + 1 + piece.length <= maxChars) {
      current = `${current} ${piece}`;
    } else {
      chunks.push(current);
      current = piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** The pieces of a lesson that can be spoken. */
export type NarrationSegment =
  | { kind: "story"; title: string; storyBeat: string; objective: string }
  | { kind: "piece_intro"; title: string; piece: string }
  | { kind: "puzzle"; prompt: string }
  | { kind: "mini_match"; prompt: string; movesRequired: number }
  | { kind: "reward"; dayNumber: number; totalDays: number; title: string }
  | { kind: "answer"; text: string };

const PIECE_MOVEMENT: Record<string, { child: string; adult: string }> = {
  pawn: {
    child: "Pawns march forward one square at a time. On their very first move they can jump two. They only take other pieces diagonally.",
    adult: "A pawn advances one square, or two from its starting rank, and captures one square diagonally.",
  },
  knight: {
    child: "The knight moves in an L shape. Two squares, then one to the side. It is the only piece that can jump over others.",
    adult: "The knight moves two squares in one direction, then one square perpendicular, and is the only piece that may jump over other pieces.",
  },
  bishop: {
    child: "The bishop slides diagonally, as far as it likes. It always stays on the same colour of square it started on.",
    adult: "The bishop moves any number of squares diagonally and is therefore confined to one square colour for the whole game.",
  },
  rook: {
    child: "The rook moves in straight lines. Up, down, left or right, as far as it likes.",
    adult: "The rook moves any number of squares along a rank or a file.",
  },
  queen: {
    child: "The queen is the most powerful piece. She moves any direction, any distance, straight or diagonally.",
    adult: "The queen combines rook and bishop movement: any number of squares along a rank, file or diagonal.",
  },
  king: {
    child: "The king moves one square at a time, in any direction. He is slow, but he is the most important piece of all.",
    adult: "The king moves one square in any direction and may never move onto a square attacked by an enemy piece.",
  },
};

/**
 * Build the narration for one lesson moment.
 *
 * Returns "" when there is nothing worth saying, and the caller then shows no
 * play button at all — a control that speaks silence is a broken control.
 */
export function narrate(segment: NarrationSegment, register: VoiceRegister): string {
  const child = register === "child";

  switch (segment.kind) {
    case "story": {
      const parts = [segment.title, segment.storyBeat];
      if (segment.objective) {
        parts.push(child ? `Today's goal. ${segment.objective}` : `Objective: ${segment.objective}`);
      }
      return sanitizeForSpeech(parts.filter(Boolean).join(". "));
    }

    case "piece_intro": {
      const movement = PIECE_MOVEMENT[String(segment.piece).toLowerCase()];
      const lead = child
        ? `Let's look at the ${segment.piece}.`
        : `The ${segment.piece}.`;
      // No entry for this piece means no invented description — the title
      // alone is spoken, and the screen still carries everything else.
      const body = movement ? (child ? movement.child : movement.adult) : "";
      return sanitizeForSpeech([lead, body].filter(Boolean).join(" "));
    }

    case "puzzle":
      return sanitizeForSpeech(
        child ? `Your turn. ${segment.prompt}` : `Puzzle. ${segment.prompt}`
      );

    case "mini_match":
      return sanitizeForSpeech(
        child
          ? `Time for a mini match. ${segment.prompt}`
          : `Mini match. ${segment.prompt} ${segment.movesRequired} moves required.`
      );

    case "reward": {
      const { dayNumber, totalDays, title } = segment;
      if (!Number.isFinite(dayNumber) || !Number.isFinite(totalDays) || totalDays <= 0) return "";
      const done = Math.min(Math.max(Math.floor(dayNumber), 1), Math.floor(totalDays));
      return sanitizeForSpeech(
        child
          ? `Well done! You finished ${title}. That's day ${done} of ${Math.floor(totalDays)}.`
          : `${title} complete. Day ${done} of ${Math.floor(totalDays)}.`
      );
    }

    case "answer":
      return sanitizeForSpeech(segment.text);

    default:
      return "";
  }
}

/**
 * Voice settings per register. The child voice is slower and slightly higher;
 * the adult voice is plain. Both stay inside a band that every engine
 * supports — extreme rates are the fastest way to make synthesis unlistenable.
 */
export function voiceSettingsFor(register: VoiceRegister): { rate: number; pitch: number } {
  return register === "child" ? { rate: 0.9, pitch: 1.1 } : { rate: 1, pitch: 1 };
}

/**
 * Pick a voice deterministically from what the device offers.
 *
 * Preference order: an exact language match that the platform marks as
 * default, then any exact match, then any voice sharing the base language,
 * then the first voice. Never returns a voice for a different language when
 * a matching one exists — a British lesson read in a Spanish voice is worse
 * than no narration.
 */
export function pickVoice<T extends { lang?: string; default?: boolean; name?: string }>(
  voices: readonly T[],
  lang = "en-GB"
): T | null {
  if (!voices || voices.length === 0) return null;
  const want = String(lang).toLowerCase();
  const base = want.split("-")[0];

  const exact = voices.filter((v) => String(v.lang ?? "").toLowerCase() === want);
  if (exact.length) return exact.find((v) => v.default) ?? exact[0];

  const sameLanguage = voices.filter((v) =>
    String(v.lang ?? "").toLowerCase().startsWith(`${base}-`) ||
    String(v.lang ?? "").toLowerCase() === base
  );
  if (sameLanguage.length) return sameLanguage.find((v) => v.default) ?? sameLanguage[0];

  return voices[0];
}
