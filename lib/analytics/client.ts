"use client";

import posthog from "posthog-js";

/**
 * V1 P1 fix #4 — the entire client-side analytics surface for Chess Mind.
 *
 * DESIGN CONSTRAINTS (all deliberate, all load-bearing):
 *  - No PII ever. `track()`'s property type only allows the enumerated
 *    fields below — there is no escape hatch to pass an arbitrary object,
 *    so a future call site literally cannot attach a child's name, a chess
 *    move, or free text even by accident.
 *  - Fails silently and safely. If NEXT_PUBLIC_POSTHOG_KEY/HOST aren't set
 *    (true in every dev/test environment today — no PostHog project has
 *    been provisioned yet), every call below is a no-op. Analytics must
 *    never throw, never block a render, and never be the reason a button
 *    doesn't work.
 *  - No autocapture, no session recording, no automatic pageviews. Only
 *    the explicit, named events this file's call sites fire — nothing
 *    incidental is ever collected.
 *  - Identification uses the app's own existing opaque child/parent UUIDs
 *    (see identify()), never an email or name.
 *
 * OPERATOR NOTE (cannot be enforced from code — must be set in the PostHog
 * project's own settings before this goes live): enable "Discard client IP
 * address" in Project Settings > general, so no IP-derived location is
 * ever retained.
 */

export type AnalyticsEventName =
  | "signup_completed"
  | "onboarding_completed"
  | "school_session_started"
  | "school_session_completed"
  | "premium_upgrade_viewed"
  | "premium_checkout_started"
  | "school_upgrade_viewed"
  | "school_checkout_started";

/**
 * The ENTIRE allow-listed property surface, repo-wide. Every field is
 * optional and every field is a bounded enum/number — never a string that
 * could carry free text. If a future event genuinely needs a new property,
 * it must be added here explicitly, not passed ad hoc.
 */
export interface AnalyticsProperties {
  /** Which screen/component fired the event — a fixed short label, not a
   * URL or free text (e.g. "classroom", "unlock_session_card"). */
  surface?: string;
  /** Chess School session number (1-30). Never the session's title/content. */
  sessionNumber?: number;
  /** "web" | "android" — already known safely from the existing Capacitor
   * detection this app uses elsewhere; never a device identifier. */
  platform?: "web" | "android";
}

let initAttempted = false;
let initialized = false;

function ensureInit(): boolean {
  if (initAttempted) return initialized;
  initAttempted = true;
  if (typeof window === "undefined") return false;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) return false; // not configured — analytics stays off
  try {
    posthog.init(key, {
      api_host: host,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      persistence: "localStorage",
    });
    initialized = true;
  } catch {
    initialized = false;
  }
  return initialized;
}

/** Ties future events to the app's own opaque child id — never a name or
 * email. Safe to call repeatedly; PostHog no-ops on a repeated identify
 * with the same id. A no-op entirely when analytics isn't configured. */
export function identify(childId: string) {
  try {
    if (!ensureInit()) return;
    posthog.identify(childId);
  } catch {
    // analytics must never break the product
  }
}

export function track(event: AnalyticsEventName, properties?: AnalyticsProperties) {
  try {
    if (!ensureInit()) return;
    posthog.capture(event, properties);
  } catch {
    // analytics must never break the product
  }
}
