/**
 * Ollie provider observability.
 *
 * WHY THIS EXISTS. Before this file, a provider failure was completely
 * silent: `callAnthropic`/`callGemini` catch every error and return `null`,
 * and `generateOllieResponse` just falls through to the local knowledge base
 * — which is the right behavior for the CHILD (no crash, no exposed error,
 * an honest answer either way), but it meant that in production there was no
 * way to tell "the Anthropic key is missing", "Anthropic is timing out" and
 * "Anthropic is fine but every reply happens to fail" apart. All three look
 * identical from the outside: a slightly duller Ollie.
 *
 * WHAT MAY NEVER BE LOGGED, EVER: the API key, the child's message, the
 * system prompt, Ollie's reply, or any other request/response body content.
 * `classifyFailure` below only ever looks at shape (was there a key? did it
 * throw? what status code came back?) and returns a short enum — never a
 * substring of anything the child or the provider actually said. This is
 * enforced structurally: classifyFailure's parameter type has no field that
 * could carry prompt text, so there is nothing sensitive to leak by mistake.
 *
 * The log call itself is a thin, guarded wrapper: it never throws, and it is
 * the ONLY place that touches console.* for this feature, so wiring is easy
 * to review file by file.
 */

export type ProviderFailureCategory =
  | "no_key"
  | "short_key"
  | "timeout"
  | "http_error"
  | "empty_response"
  | "network_error"
  | "unknown";

export interface FailureShape {
  /** Was a key present at all? */
  hasKey: boolean;
  /** Did it pass the minimum-plausible-length check? */
  keyLooksPlausible: boolean;
  /** Set only when a request actually went out and came back. */
  httpStatus?: number;
  /** True when the fetch was aborted by our own timeout controller. */
  wasAborted?: boolean;
  /** True when fetch/JSON parsing itself threw (network down, bad JSON). */
  threw?: boolean;
  /** True when the response parsed fine but carried no usable text. */
  emptyText?: boolean;
}

/**
 * Turn a failure's SHAPE into one of a small set of categories. Pure: no
 * side effects, and nothing here ever sees the actual prompt or key value —
 * only booleans and a status code.
 */
export function classifyFailure(shape: FailureShape): ProviderFailureCategory {
  if (!shape.hasKey) return "no_key";
  if (!shape.keyLooksPlausible) return "short_key";
  if (shape.wasAborted) return "timeout";
  if (shape.threw) return "network_error";
  if (typeof shape.httpStatus === "number" && shape.httpStatus >= 400) return "http_error";
  if (shape.emptyText) return "empty_response";
  return "unknown";
}

export type OllieOutcome =
  | { kind: "provider_success"; provider: "anthropic" | "development" }
  | { kind: "provider_failure"; provider: "anthropic" | "development"; category: ProviderFailureCategory }
  | { kind: "fallback_used"; reason: "provider_failed" | "provider_not_configured" };

/**
 * Record one outcome. Structured, single-line, and safe to grep in
 * production logs — every field is an enum or a provider name, never free
 * text. Wrapped in try/catch: a logging failure must never be the reason
 * Ollie fails to answer a child.
 */
export function recordOllieOutcome(outcome: OllieOutcome): void {
  try {
    const entry = { at: "ollie", ts: new Date().toISOString(), ...outcome };
    if (outcome.kind === "provider_failure") {
      console.warn("[ollie]", JSON.stringify(entry));
    } else {
      console.info("[ollie]", JSON.stringify(entry));
    }
  } catch {
    /* observability must never be why a reply fails */
  }
}
