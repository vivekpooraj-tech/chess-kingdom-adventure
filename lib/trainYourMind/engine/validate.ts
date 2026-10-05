import { Chess } from "chess.js";
import type { TrainExercise } from "../curriculum";

/**
 * Structural validation applied to EVERY exercise before it can enter the pool
 * (offline, in scripts/build-train-pool.js) and re-checked by the test suite.
 * An exercise that fails is dropped — it is never served and never padded.
 */
export function validateExercise(e: TrainExercise): string[] {
  const errors: string[] = [];
  const fail = (m: string) => errors.push(m);

  if (!e.id || e.id.length > 200) fail("bad id");
  if (!e.prompt || e.prompt.trim().length < 8) fail("empty prompt");
  if (!e.explanation?.correct || e.explanation.correct.trim().length < 12) fail("missing correct explanation");
  if (!e.explanation?.incorrect || e.explanation.incorrect.trim().length < 12) fail("missing incorrect explanation");
  if (/undefined|NaN|\[object/.test(`${e.prompt} ${e.explanation.correct} ${e.explanation.incorrect}`)) fail("template leak");
  if (![1, 2, 3, 4, 5].includes(e.level)) fail("bad level");

  let game: Chess | null = null;
  try {
    game = new Chess(e.fen);
  } catch {
    fail("illegal fen");
  }
  if (!game) return errors;
  if (game.turn() !== e.orientation && e.kind === "move") fail("orientation differs from side to move");

  const squareOk = (s: string) => /^[a-h][1-8]$/.test(s);

  if (e.kind === "choice") {
    if (e.choices.length < 2 || e.choices.length > 6) fail("choice count");
    if (new Set(e.choices).size !== e.choices.length) fail("duplicate choices");
    if (!Number.isInteger(e.correctIndex) || e.correctIndex < 0 || e.correctIndex >= e.choices.length) fail("correctIndex out of range");
    if (e.choices.some((c) => !c || !c.trim())) fail("empty choice");
    for (const s of e.highlight ?? []) if (!squareOk(s)) fail("bad highlight square");
    if (e.blind) {
      if (!(e.blind.showSeconds >= 2 && e.blind.showSeconds <= 20)) fail("bad blind seconds");
      if (e.blind.questionFen) {
        try {
          new Chess(e.blind.questionFen);
        } catch {
          fail("illegal questionFen");
        }
      }
    }
  } else {
    if (!e.steps.length) fail("no steps");
    const g = new Chess(e.fen);
    e.steps.forEach((step, i) => {
      const legal = g.moves({ verbose: true });
      const match = legal.find((m) => m.from === step.from && m.to === step.to && (!step.promotion || m.promotion === step.promotion));
      if (!match) {
        fail(`step ${i} illegal`);
        return;
      }
      for (const a of step.alts ?? []) {
        if (!legal.some((m) => m.from === a.from && m.to === a.to)) fail(`step ${i} alt illegal`);
      }
      g.move(match);
      if (step.reply) {
        const r = g.moves({ verbose: true }).find((m) => m.from === step.reply!.from && m.to === step.reply!.to);
        if (!r) fail(`step ${i} reply illegal`);
        else g.move(r);
      } else if (i < e.steps.length - 1) {
        fail(`step ${i} missing reply`);
      }
    });
    if (e.finalStepAcceptsAnyMate) {
      const last = e.steps.length - 1;
      const g2 = new Chess(e.fen);
      e.steps.slice(0, last).forEach((s) => {
        g2.move({ from: s.from, to: s.to, promotion: s.promotion });
        if (s.reply) g2.move({ from: s.reply.from, to: s.reply.to, promotion: s.reply.promotion });
      });
      const s = e.steps[last];
      g2.move({ from: s.from, to: s.to, promotion: s.promotion });
      if (!g2.isCheckmate()) fail("final step flagged mate but is not mate");
    }
  }
  return errors;
}
