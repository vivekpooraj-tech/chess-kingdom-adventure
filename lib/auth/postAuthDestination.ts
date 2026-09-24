/**
 * Where a freshly-authenticated user belongs, and whether the parent gate is
 * genuinely needed on the way there.
 *
 * THE BUG THIS FIXES. Every sign-in path lands on /parent-gate:
 *
 *   app/auth/callback/route.ts      safeNext defaults to "/parent-gate"
 *   app/sign-in/page.tsx            destination is "/parent-gate"
 *   components/CapacitorDeepLinkHandler.tsx  router.push("/parent-gate")
 *   app/reset-password/page.tsx     router.replace("/parent-gate")
 *
 * The gate then rendered its arithmetic challenge FIRST and worked out the
 * real destination only after it was solved. So a parent who finished setup
 * months ago still had to answer "6 + 4 = ?" on every single sign-in before
 * reaching /kingdom-map — and, because the gate stores nothing, on the next
 * sign-in as well, forever.
 *
 * The gate is not, and was never meant to be, a post-login step. Its own
 * docstring (and docs/04-user-flows.md) describe it as "a lightweight 'is an
 * adult here' check before any setup screen … also reused to gate entry to the
 * parent dashboard". Both of those are conditional. Landing on it
 * unconditionally is what turned it into a toll booth.
 *
 * DELIBERATELY NOT ADDED: persistence. Nothing records that the challenge was
 * passed, and nothing should — the /parent-dashboard use needs the check every
 * time a child might be holding the device, so a stored "already verified"
 * flag would defeat the one job it does have. The fix is to ask only when
 * there is actually setup to protect, not to remember having asked.
 *
 * Pure: it takes a resolved child and returns a route. No I/O, no navigation,
 * no clock — so every routing rule below is unit-testable without a database
 * (see scripts/test-post-auth-destination.js).
 */

/** The fields of a child profile that decide where its family lands. */
export interface OnboardingState {
  display_name: string | null | undefined;
  gender: string | null | undefined;
  experience_level: string | null | undefined;
  avatar_id: string | null | undefined;
  buddy_id: string | null | undefined;
}

export interface ChildResolutionLike {
  needsSelection: boolean;
  child: OnboardingState | null;
}

export interface PostAuthDestination {
  href: string;
  /**
   * True only for the /onboarding/* screens — the "setup" the gate exists to
   * put an adult in front of. /kingdom-map and /choose-child are ordinary
   * returning-user destinations and are never gated.
   */
  requiresParentGate: boolean;
}

export const CHOOSE_CHILD = "/choose-child";
export const ONBOARDING_EXPERIENCE = "/onboarding/experience";
export const ONBOARDING_NAME = "/onboarding/name";
export const ONBOARDING_GENDER = "/onboarding/gender";
export const ONBOARDING_AVATAR = "/onboarding/avatar";
export const DASHBOARD = "/kingdom-map";

/**
 * SINGLE SOURCE OF TRUTH for "is this child's profile complete enough for
 * Home" — every place in the app that needs this answer (this file,
 * app/(tabs)/kingdom-map/page.tsx's guard, app/choose-child/page.tsx's
 * choose(), app/onboarding/experience/page.tsx's self-redirect) calls this
 * function rather than re-deriving the rule, so there is exactly one
 * definition of "incomplete" to keep in sync. If you need a fifth caller,
 * import this — do not write a sixth copy of the field checks.
 *
 * Two different sequences, depending on when the child was created:
 *
 * GRANDFATHERED (`avatar_id` already set — the last step of onboarding
 * before this feature existed): only experience_level is still checked,
 * exactly as before this feature. name/gender simply didn't exist as
 * required steps when they onboarded, so existing users are never swept
 * back into the new screens or have their stored name/avatar touched.
 *
 * GENUINELY NEW (`avatar_id` never set): name -> gender -> avatar ->
 * experience_level, matching the product's required order (Signup -> Name
 * -> Gender -> Avatar -> the rest of the existing onboarding flow -> Home).
 * Once avatar is chosen, they rejoin the original chain at
 * /onboarding/experience exactly like every user before them.
 */
export function nextRequiredOnboardingStep(child: OnboardingState): string | null {
  if (child.avatar_id) {
    return child.experience_level ? null : ONBOARDING_EXPERIENCE;
  }
  if (!child.display_name || !child.display_name.trim()) return ONBOARDING_NAME;
  if (!child.gender) return ONBOARDING_GENDER;
  return ONBOARDING_AVATAR;
}

export function isChildProfileComplete(child: OnboardingState): boolean {
  return nextRequiredOnboardingStep(child) === null;
}

/**
 * Resolve the destination.
 *
 * The order matches app/(tabs)/kingdom-map/page.tsx's own guard exactly —
 * both call nextRequiredOnboardingStep() — which is what keeps the two from
 * disagreeing and bouncing a user back and forth. If you change one, change
 * both (and app/choose-child/page.tsx, and
 * app/onboarding/experience/page.tsx's self-redirect).
 *
 * A null child with needsSelection false is the "profile temporarily missing"
 * case: resolveActiveChild() normally creates one, so this only happens when a
 * read came back empty unexpectedly. Sending them to /choose-child is the safe
 * fallback — it re-resolves from scratch and can create the child — rather
 * than assuming setup is complete (which would strand them on a dashboard with
 * no profile) or assuming it is not (which would re-run onboarding for someone
 * who already finished it).
 */
export function postAuthDestination(resolution: ChildResolutionLike): PostAuthDestination {
  if (resolution.needsSelection || !resolution.child) {
    return { href: CHOOSE_CHILD, requiresParentGate: false };
  }

  const nextStep = nextRequiredOnboardingStep(resolution.child);
  if (nextStep) {
    // Only the two "entry" screens (first step for a brand-new profile, or
    // first step for a grandfathered one) sit behind the parent gate — the
    // gate's job is to confirm an adult is present before ANY setup starts,
    // not to re-challenge on every individual step within that setup.
    const isEntryStep = nextStep === ONBOARDING_NAME || nextStep === ONBOARDING_EXPERIENCE;
    return { href: nextStep, requiresParentGate: isEntryStep };
  }
  return { href: DASHBOARD, requiresParentGate: false };
}

/** True when this user has finished setup and should go straight in. */
export function isOnboardingComplete(resolution: ChildResolutionLike): boolean {
  return !postAuthDestination(resolution).requiresParentGate;
}
