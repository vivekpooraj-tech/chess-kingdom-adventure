/**
 * Tunables for Train Your Chess Mind's persistent exercise history
 * (supabase/migrations/0053_train_your_mind_exercise_history.sql).
 */

/** Rows read per (child, module). Must stay <= the 200-row retention cap in
 * record_train_your_mind_exercise_seen(). */
export const HISTORY_FETCH_LIMIT = 100;

/** An exercise is "recent" if it is among the newest N the child has seen in
 * this module... */
export const RECENT_WINDOW_COUNT = 30;

/** ...and was seen within this many days. Older exposures are forgotten so a
 * small pool is not permanently exhausted. */
export const RECENT_MAX_AGE_DAYS = 30;
export const RECENT_MAX_AGE_MS = RECENT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

/** How many random candidates a generator-based drill draws before the
 * selector picks the best unseen one. */
export const GENERATED_CANDIDATE_COUNT = 40;
