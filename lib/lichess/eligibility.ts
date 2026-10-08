/**
 * Who may connect a Lichess account (v1): adult (18+) profiles only.
 *
 * Lichess requires its own account holders to be at least 15 (younger only
 * via a parent/teacher-created kid account), and its Terms forbid account
 * sharing. Chess Mind's age bands are self-reported and `teen` is "14-17",
 * which straddles that minimum, so every band under 18 is excluded, and a
 * missing band is NEVER assumed adult (see lib/learner/experienceLevel.ts).
 * Normal Chess Mind play is unaffected for everyone.
 */
export function isLichessEligible(ageBand: string | null | undefined): boolean {
  return ageBand === "adult";
}
