/**
 * One validated source of truth for the Supabase connection settings.
 *
 * WHY THIS EXISTS. Every Supabase client in this project used to be built as:
 *
 *   createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, …)
 *
 * The `!` is a TypeScript assertion with no runtime effect, so a missing or
 * malformed value reached the SDK unchecked and it threw:
 *
 *   "Your project's URL and Key are required to create a Supabase client!"
 *   "Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL."
 *
 * Thrown from middleware, that is fatal for the ENTIRE site: Vercel answers
 * every matched request with 500 MIDDLEWARE_INVOCATION_FAILED, including the
 * public marketing page and the sign-in screen. One unset variable took the
 * whole product down, and the error surfaced as a platform crash page rather
 * than as something naming the actual cause.
 *
 * So: read the values through here, normalise the mistakes that are safe to
 * normalise, reject the rest with a message that names the variable and the
 * problem, and never let a bad value reach the SDK.
 *
 * The two variables are the only ones the browser needs, and their names are
 * fixed by Next.js's NEXT_PUBLIC_ inlining:
 *
 *   NEXT_PUBLIC_SUPABASE_URL       https://<project-ref>.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  the anon/publishable key (safe in a browser)
 *
 * SUPABASE_SERVICE_ROLE_KEY is deliberately NOT handled here — it must never
 * be bundled for the browser, so it stays in lib/supabase/admin.ts behind its
 * own server-only check.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export type SupabaseConfigResult =
  | { ok: true; config: SupabaseConfig; warnings: string[] }
  | { ok: false; problems: string[] };

export const SUPABASE_URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
export const SUPABASE_ANON_KEY_VAR = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

/**
 * Undo the ways an environment variable gets mangled between a dashboard text
 * box and `process.env`:
 *
 *   ' https://x.supabase.co '   copy/paste padding, or a trailing newline
 *   '"https://x.supabase.co"'   quoted because a .env file kept the quotes
 *   "'https://x.supabase.co'"   same, single-quoted
 *
 * Quotes are stripped repeatedly because a value can pick up more than one
 * layer (a quoted value pasted into a quoted field). Only MATCHING pairs are
 * removed, so a value that legitimately starts or ends with a quote is left
 * alone rather than silently truncated.
 */
export function sanitizeEnvValue(raw: string | undefined | null): string {
  if (typeof raw !== "string") return "";
  let value = raw.trim();
  while (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    const quoted =
      (first === '"' && last === '"') ||
      (first === "'" && last === "'") ||
      (first === "`" && last === "`");
    if (!quoted) break;
    value = value.slice(1, -1).trim();
  }
  return value;
}

/**
 * Normalise the project URL to a bare origin, or explain why it cannot be.
 *
 * Two mistakes are corrected rather than rejected, because both are
 * unambiguous and rejecting them means the site stays down:
 *
 *   "abc.supabase.co"            -> "https://abc.supabase.co"   (missing scheme)
 *   "https://abc.supabase.co/"   -> "https://abc.supabase.co"   (trailing slash/path)
 *
 * The missing-scheme case is exactly what produces "Invalid supabaseUrl", and
 * it is also what breaks OAuth when the same mistake is made in the Supabase
 * dashboard's Site URL — see the note in docs on Site URL. Each correction is
 * reported as a warning so the underlying misconfiguration still gets fixed at
 * source instead of being hidden forever.
 *
 * Anything genuinely ambiguous — an empty value, a non-http(s) scheme, a value
 * that will not parse as a URL — is a hard problem, not a guess.
 */
export function normalizeSupabaseUrl(
  raw: string | undefined | null
): { url: string; warnings: string[] } | { problem: string } {
  const warnings: string[] = [];
  const cleaned = sanitizeEnvValue(raw);

  if (!cleaned) {
    return { problem: `${SUPABASE_URL_VAR} is missing or empty.` };
  }
  if (/\s/.test(cleaned)) {
    return { problem: `${SUPABASE_URL_VAR} contains whitespace: ${JSON.stringify(cleaned)}` };
  }

  let candidate = cleaned;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`;
    warnings.push(
      `${SUPABASE_URL_VAR} had no scheme; assuming https:// . Set it to "${candidate}" to remove this warning.`
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { problem: `${SUPABASE_URL_VAR} is not a valid URL: ${JSON.stringify(cleaned)}` };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      problem: `${SUPABASE_URL_VAR} must be an http(s) URL, got "${parsed.protocol}//".`,
    };
  }
  if (!parsed.hostname) {
    return { problem: `${SUPABASE_URL_VAR} has no host: ${JSON.stringify(cleaned)}` };
  }

  // The SDK wants the project origin. A pasted REST/auth path ("…/rest/v1")
  // or a stray query string would otherwise be baked into every request URL.
  if ((parsed.pathname && parsed.pathname !== "/") || parsed.search || parsed.hash) {
    warnings.push(
      `${SUPABASE_URL_VAR} included a path/query ("${parsed.pathname}${parsed.search}${parsed.hash}"); using the origin "${parsed.origin}" instead.`
    );
  }

  return { url: parsed.origin, warnings };
}

/** The anon key is opaque, so only structural mistakes can be caught here. */
export function normalizeSupabaseAnonKey(
  raw: string | undefined | null
): { anonKey: string } | { problem: string } {
  const cleaned = sanitizeEnvValue(raw);
  if (!cleaned) {
    return { problem: `${SUPABASE_ANON_KEY_VAR} is missing or empty.` };
  }
  if (/\s/.test(cleaned)) {
    return { problem: `${SUPABASE_ANON_KEY_VAR} contains whitespace — it was probably pasted with a line break.` };
  }
  return { anonKey: cleaned };
}

/**
 * Read both variables and report every problem at once.
 *
 * Pure: the environment is a parameter, so this is fully testable without
 * touching process.env (see scripts/test-supabase-env.js). Never throws —
 * callers decide what a bad config means for them, which is the whole point:
 * middleware degrades, everything else fails loudly.
 */
export function readSupabaseConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): SupabaseConfigResult {
  const problems: string[] = [];
  const warnings: string[] = [];

  const urlResult = normalizeSupabaseUrl(env[SUPABASE_URL_VAR]);
  const keyResult = normalizeSupabaseAnonKey(env[SUPABASE_ANON_KEY_VAR]);

  if ("problem" in urlResult) problems.push(urlResult.problem);
  else warnings.push(...urlResult.warnings);

  if ("problem" in keyResult) problems.push(keyResult.problem);

  if ("problem" in urlResult || "problem" in keyResult) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    config: { url: (urlResult as { url: string }).url, anonKey: (keyResult as { anonKey: string }).anonKey },
    warnings,
  };
}

/** One-line summary for a log, naming the variables that need attention. */
export function describeSupabaseConfigProblem(problems: string[]): string {
  return (
    `[supabase] Configuration invalid — ${problems.join(" ")} ` +
    `Set ${SUPABASE_URL_VAR} and ${SUPABASE_ANON_KEY_VAR} for every environment ` +
    `(Production, Preview and Development) and redeploy; Vercel only picks up ` +
    `environment changes on a new deployment.`
  );
}

// Warnings are identical on every request, so log each distinct one once per
// runtime instance rather than on every navigation.
const loggedOnce = new Set<string>();
export function logSupabaseConfigOnce(message: string): void {
  if (loggedOnce.has(message)) return;
  loggedOnce.add(message);
  console.warn(message);
}

/**
 * The strict accessor, for code that genuinely cannot proceed without a
 * database. Throws a message that names the variable and the fault, instead of
 * the SDK's context-free "Invalid supabaseUrl".
 *
 * Middleware deliberately does NOT use this — see middleware.ts.
 */
export function getSupabaseConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): SupabaseConfig {
  const result = readSupabaseConfig(env);
  if (!result.ok) {
    throw new Error(describeSupabaseConfigProblem(result.problems));
  }
  result.warnings.forEach((w) => logSupabaseConfigOnce(`[supabase] ${w}`));
  return result.config;
}
