import type { TacticsPuzzle } from "@/lib/puzzles/tacticsTypes";
import { LEVELS, type EngineCategory, type Level, type TrainExercise } from "../curriculum";
import { selectExercise, recentIdSet, type HistoryEntry } from "../exerciseSelection";
import { CALCULATION_FAMILIES } from "./families/calculation";
import { PATTERN_FAMILIES } from "./families/pattern";
import { VISUALIZATION_FAMILIES } from "./families/visualization";
import { MEMORY_FAMILIES } from "./families/memory";
import { SPATIAL_FAMILIES } from "./families/spatial";
import { MATHEMATICS_FAMILIES } from "./families/mathematics";
import { REACTION_FAMILIES } from "./families/reaction";
import { exerciseId, type Descriptor, type FamilyDef } from "./families/types";

/**
 * The exercise pool.
 *
 * Which puzzle belongs to which family/level is computed OFFLINE by
 * scripts/build-train-pool.js (it classifies every puzzle AND builds the
 * exercise once to prove it validates) and stored as a compact index:
 *
 *     { families: { "calc.line2": { "2": ["lc-00a", ...], "3": [...] }, ... } }
 *
 * At runtime the server only reads the index and builds the ONE exercise it
 * serves. Nothing here ever ships to the browser.
 */

export const FAMILIES: FamilyDef[] = [
  ...PATTERN_FAMILIES,
  ...VISUALIZATION_FAMILIES,
  ...CALCULATION_FAMILIES,
  ...MEMORY_FAMILIES,
  ...SPATIAL_FAMILIES,
  ...MATHEMATICS_FAMILIES,
  ...REACTION_FAMILIES,
];

export function familiesFor(category: EngineCategory): FamilyDef[] {
  return FAMILIES.filter((f) => f.category === category);
}

export function familyById(id: string): FamilyDef | undefined {
  return FAMILIES.find((f) => f.id === id);
}

/** family id -> level ("1".."5") -> keys (puzzle ids, or authored keys). */
export interface PoolIndex {
  version: number;
  families: Record<string, Record<string, string[]>>;
}

export const POOL_INDEX_VERSION = 1;

/** Classify only (no validation) — used by the offline builder and tests. */
export function classifyPuzzle(puzzle: TacticsPuzzle, families: readonly FamilyDef[] = FAMILIES): { family: string; level: Level }[] {
  const out: { family: string; level: Level }[] = [];
  const usedSignatures = new Set<string>();
  for (const f of families) {
    if (!f.classify) continue;
    // Same question about the same position is never offered twice (first family wins).
    if (f.signature && usedSignatures.has(f.signature)) continue;
    let level: Level | null = null;
    try {
      level = f.classify(puzzle);
    } catch {
      level = null;
    }
    if (level) {
      out.push({ family: f.id, level });
      if (f.signature) usedSignatures.add(f.signature);
    }
  }
  return out;
}

export function staticDescriptors(families: readonly FamilyDef[] = FAMILIES): { family: string; key: string; level: Level }[] {
  const out: { family: string; key: string; level: Level }[] = [];
  for (const f of families) if (f.statics) for (const s of f.statics()) out.push({ family: f.id, key: s.key, level: s.level });
  return out;
}

const descriptorCache = new WeakMap<PoolIndex, Map<string, Descriptor[]>>();

/** Descriptors for one category + level, built lazily from the index and cached. */
export function descriptorsFor(index: PoolIndex, category: EngineCategory, level: Level): Descriptor[] {
  let perIndex = descriptorCache.get(index);
  if (!perIndex) descriptorCache.set(index, (perIndex = new Map()));
  const cacheKey = `${category}:${level}`;
  const cached = perIndex.get(cacheKey);
  if (cached) return cached;
  const out: Descriptor[] = [];
  for (const f of familiesFor(category)) {
    const keys = index.families[f.id]?.[String(level)];
    if (!keys) continue;
    for (const key of keys) out.push({ id: exerciseId(f.id, key), family: f.id, category, level, key });
  }
  perIndex.set(cacheKey, out);
  return out;
}

export function levelCounts(index: PoolIndex, category: EngineCategory): Record<Level, number> {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<Level, number>;
  for (const f of familiesFor(category)) {
    for (const l of LEVELS) counts[l] += index.families[f.id]?.[String(l)]?.length ?? 0;
  }
  return counts;
}

/** Nearest level that actually has content: the one asked for, then lower, then higher. */
export function levelWithContent(index: PoolIndex, category: EngineCategory, wanted: Level): Level | null {
  const counts = levelCounts(index, category);
  if (counts[wanted] > 0) return wanted;
  for (let l = wanted - 1; l >= 1; l--) if (counts[l as Level] > 0) return l as Level;
  for (let l = wanted + 1; l <= 5; l++) if (counts[l as Level] > 0) return l as Level;
  return null;
}

export interface PickRequest {
  category: EngineCategory;
  level: Level;
  history: readonly HistoryEntry[];
  /** Ids seen this page session (not yet in history), plus the one on screen. */
  exclude?: readonly string[];
  /** Family of the exercise just shown; avoided when another family has content. */
  lastFamily?: string | null;
  /** Restrict to one family (reinforcement after repeated mistakes in it). */
  onlyFamily?: string | null;
  now?: number;
  rng?: () => number;
}

export interface Picked {
  exercise: TrainExercise;
  servedLevel: Level;
  reason: "unseen" | "least-recent";
}

export function pickExercise(
  index: PoolIndex,
  puzzlesById: ReadonlyMap<string, TacticsPuzzle>,
  req: PickRequest
): Picked | null {
  const rng = req.rng ?? Math.random;
  const level = levelWithContent(index, req.category, req.level);
  if (!level) return null;

  let all = descriptorsFor(index, req.category, level);
  if (req.onlyFamily) all = all.filter((d) => d.family === req.onlyFamily);
  if (!all.length) return null;
  const avoid = new Set(req.exclude ?? []);
  const recent = recentIdSet(req.history, { now: req.now });
  const dropped = new Set<string>();

  for (let attempt = 0; attempt < 12; attempt++) {
    const live = dropped.size ? all.filter((d) => !dropped.has(d.id)) : all;
    if (!live.length) return null;
    let chosen: Descriptor | null = null;
    let reason: Picked["reason"] = "unseen";

    // Fast path: draw random candidates and keep the first unseen one — avoids
    // scanning a pool of tens of thousands on every request.
    const byFamily = new Map<string, Descriptor[]>();
    for (const d of live) {
      let list = byFamily.get(d.family);
      if (!list) byFamily.set(d.family, (list = []));
      list.push(d);
    }
    let families = [...byFamily.keys()];
    if (req.lastFamily && families.length > 1) families = families.filter((f) => f !== req.lastFamily);
    // Try families in random order until one yields an unseen exercise.
    const order = [...families].sort(() => rng() - 0.5);
    for (const fam of order) {
      const list = byFamily.get(fam)!;
      for (let t = 0; t < 40; t++) {
        const d = list[Math.floor(rng() * list.length)];
        if (!recent.has(d.id) && !avoid.has(d.id)) {
          chosen = d;
          break;
        }
      }
      if (chosen) break;
    }

    if (!chosen) {
      // Every sampled candidate was recent: fall back to the least-recently-seen one.
      const sel = selectExercise(live, (d) => d.id, req.history, { now: req.now, avoidIds: [...avoid], rng });
      if (!sel) return null;
      chosen = sel.item;
      reason = "least-recent";
    }

    const family = familyById(chosen.family);
    const exercise = family?.build({ key: chosen.key, level: chosen.level, puzzle: puzzlesById.get(chosen.key) }) ?? null;
    if (exercise && exercise.id === chosen.id) return { exercise, servedLevel: level, reason };

    // Failed validation: drop it and try another. Never serve a broken exercise.
    dropped.add(chosen.id);
  }
  return null;
}

export { LEVELS };
