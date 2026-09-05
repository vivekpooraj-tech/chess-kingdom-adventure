import fs from "node:fs";
import path from "node:path";
import type { TacticsPuzzle, TacticsSkill, TacticsTier } from "./tacticsTypes";

/**
 * Server-only access to the curated tactics library.
 *
 * SERVER ONLY. Never import this from a client component. The library is a
 * ~1.8MB JSON file of 5,000 puzzles; the entire point of this module is that
 * it stays on the server and the browser only ever receives the one puzzle it
 * is about to solve. That is also why the file is read with `fs` at runtime
 * rather than `import`ed — an import would let the bundler inline all 1.8MB
 * into a JS chunk, which is exactly the problem this replaces.
 *
 * Scaling note: the load is lazy and cached for the lifetime of the server
 * instance, so a warm function pays nothing. At 5,000 puzzles a full in-memory
 * load is comfortably the simplest correct thing. Past roughly 50k it is worth
 * moving the pool into Postgres and selecting with SQL instead — the selection
 * contract below is deliberately narrow so that swap stays local to this file.
 */

const LIBRARY_PATH = path.join(process.cwd(), "data", "puzzles", "tactics-library.json");

let cache: TacticsPuzzle[] | null = null;
let loadFailed = false;

/** The whole library, loaded once per server instance. Empty array if the
 *  data file is missing, so a deployment that failed to include it degrades
 *  to "no tactics puzzles" rather than crashing every request. */
export function getTacticsLibrary(): TacticsPuzzle[] {
  if (cache) return cache;
  if (loadFailed) return [];
  try {
    cache = JSON.parse(fs.readFileSync(LIBRARY_PATH, "utf8")) as TacticsPuzzle[];
    return cache;
  } catch {
    loadFailed = true;
    return [];
  }
}

/** Index built once alongside the library so selection never rescans 5,000
 *  entries per request. */
let byBucket: Map<string, TacticsPuzzle[]> | null = null;

function bucketKey(skill: TacticsSkill, tier: TacticsTier) {
  return `${skill}|${tier}`;
}

function getIndex(): Map<string, TacticsPuzzle[]> {
  if (byBucket) return byBucket;
  const map = new Map<string, TacticsPuzzle[]>();
  for (const p of getTacticsLibrary()) {
    const k = bucketKey(p.skill, p.tier);
    const list = map.get(k);
    if (list) list.push(p);
    else map.set(k, [p]);
  }
  byBucket = map;
  return map;
}

export interface SelectParams {
  /** Preferred skill. Falls back across the whole tier when it has nothing
   *  left, rather than returning nothing. */
  skill?: TacticsSkill | null;
  tier: TacticsTier;
  /** Ids the child has already solved, plus anything the client asks to skip. */
  exclude?: ReadonlySet<string>;
}

/**
 * Choose one puzzle.
 *
 * Widens deliberately rather than ever returning null while playable puzzles
 * remain: preferred skill+tier -> any skill in that tier -> adjacent tiers ->
 * anything unexcluded -> anything at all. The last step allows a genuine
 * repeat, which is the right outcome for a child who has solved everything in
 * a bucket: repeating a puzzle is much better than an empty screen, and
 * spaced repetition is a feature rather than a bug.
 */
export function selectTacticsPuzzle(params: SelectParams): TacticsPuzzle | null {
  const library = getTacticsLibrary();
  if (library.length === 0) return null;

  const exclude = params.exclude ?? new Set<string>();
  const index = getIndex();
  const tiers = adjacentTiers(params.tier);

  const attempts: TacticsPuzzle[][] = [];

  if (params.skill) {
    attempts.push(index.get(bucketKey(params.skill, params.tier)) ?? []);
  }
  // Same tier, any skill.
  attempts.push(library.filter((p) => p.tier === params.tier));
  // Neighbouring difficulty, preferring the requested skill if there is one.
  for (const t of tiers) {
    if (params.skill) attempts.push(index.get(bucketKey(params.skill, t)) ?? []);
    attempts.push(library.filter((p) => p.tier === t));
  }
  attempts.push(library);

  for (const pool of attempts) {
    const fresh = pool.filter((p) => !exclude.has(p.id));
    if (fresh.length > 0) return fresh[Math.floor(Math.random() * fresh.length)];
  }

  // Everything is excluded — allow a repeat rather than showing nothing.
  return library[Math.floor(Math.random() * library.length)];
}

/** Tiers to try after the requested one, nearest first, so a beginner never
 *  jumps straight to advanced material. */
function adjacentTiers(tier: TacticsTier): TacticsTier[] {
  if (tier === "beginner") return ["intermediate"];
  if (tier === "advanced") return ["intermediate"];
  return ["beginner", "advanced"];
}

/**
 * Difficulty for a learner, from the signals the app actually records.
 *
 * Experience level is the floor; sustained puzzle success promotes. There is
 * no demotion on a bad run: a child having a rough session does not need the
 * app to visibly downgrade them, and the widening in selectTacticsPuzzle
 * already keeps them from being stuck on something too hard.
 */
export function tierForLearner(
  experienceLevel: "new" | "knows_basics" | "plays_regularly" | null,
  firstTryRate: number | null,
  solvedCount: number
): TacticsTier {
  let tier: TacticsTier =
    experienceLevel === "plays_regularly"
      ? "intermediate"
      : experienceLevel === "knows_basics"
        ? "beginner"
        : "beginner";

  // Promote only on a real track record: a high rate over 3 solves is noise.
  if (solvedCount >= 20 && firstTryRate !== null && firstTryRate >= 0.7) {
    tier = tier === "beginner" ? "intermediate" : "advanced";
  }
  return tier;
}

/** Library stats, for validation scripts and the dev report. */
export function getTacticsLibraryStats() {
  const library = getTacticsLibrary();
  const bySkill: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  for (const p of library) {
    bySkill[p.skill] = (bySkill[p.skill] ?? 0) + 1;
    byTier[p.tier] = (byTier[p.tier] ?? 0) + 1;
  }
  return { total: library.length, bySkill, byTier };
}
