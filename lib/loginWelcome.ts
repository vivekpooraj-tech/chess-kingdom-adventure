/**
 * The cold-launch guard for Video 2 (the returning-user welcome animation).
 *
 * sessionStorage, not a DB column or a module-level JS flag, because its
 * lifetime is EXACTLY what "once per genuine cold launch" needs: it
 * survives a route change, a component remount, and Android backgrounding
 * (the WebView process — and its JS heap — is not destroyed by a mere
 * foreground/background cycle), but is gone the moment the process is
 * genuinely killed and relaunched, which recreates the WebView with a
 * fresh, empty sessionStorage. components/nav/NativeLayoutProvider.tsx
 * already relies on this exact same distinction ("sessionStorage survives
 * a reload but not an app restart") for an unrelated reason — this reuses
 * the same underlying platform fact, not a new assumption.
 *
 * Used by app/page.tsx (Trigger B: cold launch) to decide whether to show
 * the video at all. app/parent-gate/page.tsx (Trigger A: a genuine sign-in)
 * does NOT read this flag before deciding to show the video — a deliberate
 * sign-out-then-sign-in is its own explicit event, independent of whatever
 * happened earlier in the same browser/WebView session — but it does SET
 * this flag afterward, so a stray later visit to "/" in that same session
 * doesn't also replay it via Trigger B.
 */
const SESSION_KEY = "chessmind_login_welcome_shown";

export function hasShownLoginWelcomeThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    // Private-browsing/storage-blocked: fail toward NOT replaying the video
    // forever would be worse than occasionally skipping it, but the far
    // more common real failure mode is storage being unavailable entirely,
    // in which case treating it as "already shown" (skip) is the safer
    // default — never trap a login behind a video that can't be tracked.
    return true;
  }
}

export function markLoginWelcomeShownThisSession(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Nothing to do — see hasShownLoginWelcomeThisSession()'s fallback.
  }
}
