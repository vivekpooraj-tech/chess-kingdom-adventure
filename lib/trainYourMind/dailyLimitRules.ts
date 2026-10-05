import { DAILY_LIMITS } from "@/lib/entitlement/dailyLimits";

/**
 * The Train Your Chess Mind free daily limit, as one pure rule set.
 *
 * FREE: at most FREE_DAILY_COMPLETIONS (3) completed exercises PER CATEGORY, per child,
 * per calendar day. The eight categories — Pattern, Visualization, Calculation, Memory,
 * Spatial, Mathematics, Reaction and Tactical Thinking — are counted INDEPENDENTLY.
 * PREMIUM: no limit.
 *
 * The authoritative implementation is SQL —
 * supabase/migrations/0055_train_your_mind_global_daily_limit.sql
 * (record_train_your_mind_completion / get_train_your_mind_usage). This file is the same
 * rule in TypeScript, for two reasons: the serve routes share its tiny gate decision, and
 * scripts/test-train-your-mind-daily-limit.js drives it through the whole scenario matrix
 * (the database function cannot be exercised until the migration is approved and
 * applied). The test also pins the SQL's literals and structure to this file so the two
 * cannot drift.
 */
export const FREE_DAILY_COMPLETIONS: number = DAILY_LIMITS.trainYourMindPerCategory;

export const TRAIN_MODULES = [
  "pattern",
  "visualization",
  "calculation",
  "memory",
  "spatial",
  "mathematics",
  "reaction",
  "tactical",
] as const;
export type TrainModule = (typeof TRAIN_MODULES)[number];

export interface UsageState {
  usedToday: number;
  /** null = unlimited (Premium). */
  remaining: number | null;
  /** null = unlimited (Premium). */
  limit: number | null;
  isPremium: boolean;
  /** True when a FREE child has used every slot today IN THIS CATEGORY. Never true for Premium. */
  reached: boolean;
}

export function usageState(usedToday: number, isPremium: boolean): UsageState {
  if (isPremium) return { usedToday, remaining: null, limit: null, isPremium: true, reached: false };
  return {
    usedToday,
    remaining: Math.max(0, FREE_DAILY_COMPLETIONS - usedToday),
    limit: FREE_DAILY_COMPLETIONS,
    isPremium: false,
    reached: usedToday >= FREE_DAILY_COMPLETIONS,
  };
}

/** Should an exercise be SERVED? `usedToday` is the count for the category being asked for. */
export function mayServe(isPremium: boolean, usedToday: number): boolean {
  return isPremium || usedToday < FREE_DAILY_COMPLETIONS;
}

// --------------------------------------------------------------------------
// Reference model of the SQL ledger (mirrors the migration line for line).
// --------------------------------------------------------------------------
export interface LedgerRow {
  childId: string;
  key: string;
  date: string; // YYYY-MM-DD
  module: TrainModule;
}

const DAY_MS = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const shift = (date: string, days: number) => isoDate(new Date(Date.parse(date + "T00:00:00Z") + days * DAY_MS));

/** SQL: public.tym_effective_date — the clamped day bucket (child-wide, not per category). */
export function effectiveDate(rows: readonly LedgerRow[], childId: string, requested: string | null, nowUtc: Date): string {
  const today = isoDate(nowUtc);
  const mine = rows.filter((r) => r.childId === childId).map((r) => r.date);
  const latest = mine.length ? mine.reduce((a, b) => (a > b ? a : b)) : "0001-01-01";
  const lower = [requested ?? today, shift(today, -1), latest].reduce((a, b) => (a > b ? a : b));
  const upper = shift(today, 1);
  return lower < upper ? lower : upper;
}

/** Completions for ONE category on one day. */
export function usedOn(rows: readonly LedgerRow[], childId: string, date: string, module: TrainModule): number {
  return rows.filter((r) => r.childId === childId && r.date === date && r.module === module).length;
}

/** SQL: public.get_train_your_mind_usage — the row for one category. */
export function getUsage(
  rows: readonly LedgerRow[],
  args: { childId: string; module: TrainModule; requestedDate: string | null; isPremium: boolean; nowUtc: Date }
): UsageState {
  const date = effectiveDate(rows, args.childId, args.requestedDate, args.nowUtc);
  return usageState(usedOn(rows, args.childId, date, args.module), args.isPremium);
}

export interface CompletionResult {
  allowed: boolean;
  duplicate: boolean;
  usedToday: number;
  remaining: number | null;
  isPremium: boolean;
}

/** SQL: public.record_train_your_mind_completion. Mutates `rows` exactly as the INSERT would. */
export function recordCompletion(
  rows: LedgerRow[],
  args: { childId: string; module: TrainModule; key: string; requestedDate: string | null; isPremium: boolean; nowUtc: Date }
): CompletionResult {
  if (!(TRAIN_MODULES as readonly string[]).includes(args.module)) throw new Error("invalid module");
  if (!args.key || args.key.length < 8 || args.key.length > 80) throw new Error("invalid completion");
  const date = effectiveDate(rows, args.childId, args.requestedDate, args.nowUtc);
  const used = usedOn(rows, args.childId, date, args.module);

  if (rows.some((r) => r.childId === args.childId && r.key === args.key)) {
    return { allowed: true, duplicate: true, usedToday: used, remaining: args.isPremium ? null : Math.max(0, FREE_DAILY_COMPLETIONS - used), isPremium: args.isPremium };
  }
  if (!args.isPremium && used >= FREE_DAILY_COMPLETIONS) {
    return { allowed: false, duplicate: false, usedToday: used, remaining: 0, isPremium: false };
  }
  rows.push({ childId: args.childId, key: args.key, date, module: args.module });
  const after = used + 1;
  return { allowed: true, duplicate: false, usedToday: after, remaining: args.isPremium ? null : Math.max(0, FREE_DAILY_COMPLETIONS - after), isPremium: args.isPremium };
}

/** Validate the YYYY-MM-DD the client sends (its local calendar day). */
export function parseClientDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const t = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(t) && isoDate(new Date(t)) === value ? value : null;
}
