import fs from "node:fs";
import path from "node:path";
import type { TacticsPuzzle } from "@/lib/puzzles/tacticsTypes";
import type { PoolIndex } from "./pool";

/**
 * SERVER ONLY. Loads the puzzle libraries and the precomputed pool index for the
 * Train Your Chess Mind engine.
 *
 *  - data/puzzles/tactics-library.json        the original 5,000-puzzle library
 *  - data/puzzles/tactics-library-train.json  the extended Train Your Mind library
 *                                             (same schema; optional)
 *  - data/trainYourMind/pool-index.json       which puzzle serves which exercise
 *                                             family/level (scripts/build-train-pool.js)
 *
 * Read with fs at runtime (never imported) so none of it is bundled for the
 * browser; the learner only ever receives the one exercise it is about to solve.
 */

const BASE_PATH = path.join(process.cwd(), "data", "puzzles", "tactics-library.json");
const EXTRA_PATH = path.join(process.cwd(), "data", "puzzles", "tactics-library-train.json");
const INDEX_PATH = path.join(process.cwd(), "data", "trainYourMind", "pool-index.json");

let puzzles: Map<string, TacticsPuzzle> | null = null;
let index: PoolIndex | null | undefined;

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function getTrainPuzzles(): Map<string, TacticsPuzzle> {
  if (puzzles) return puzzles;
  const map = new Map<string, TacticsPuzzle>();
  for (const file of [BASE_PATH, EXTRA_PATH]) {
    const list = readJson<TacticsPuzzle[]>(file);
    if (list) for (const p of list) if (!map.has(p.id)) map.set(p.id, p);
  }
  puzzles = map;
  return map;
}

export function getPoolIndex(): PoolIndex | null {
  if (index !== undefined) return index;
  index = readJson<PoolIndex>(INDEX_PATH);
  return index;
}
