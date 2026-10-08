/**
 * Lichess OAuth (authorization-code + PKCE, S256) for an adult profile's OWN Lichess account.
 *
 * Public client: no secret exists anywhere. The only scope requested is `board:play`. Nothing here logs, and no token is ever put in a URL.
 * The token itself never leaves lib/lichess/tokenStore.ts (browser storage, per Chess Mind profile) — it is not sent to our servers.
 *
 * REDIRECT URIs. Lichess accepts an http(s) URI, a few allow-listed schemes, or any scheme that CONTAINS A DOT; a plain custom scheme such as
 * `chesskingdom://` is rejected. So:
 *   web     -> `${origin}/lichess/callback`
 *   Android -> `com.chesskingdom.adventure://lichess/callback` (the app id; routed back by AndroidManifest.xml + CapacitorDeepLinkHandler)
 * This is separate from the Supabase sign-in callback (`chesskingdom://auth/callback`), which is untouched.
 */

export const LICHESS_ORIGIN = "https://lichess.org";
/** Lichess supports unregistered public clients: any unique id. */
export const LICHESS_CLIENT_ID = "www.chessmind.club";
export const LICHESS_SCOPE = "board:play";
export const LICHESS_NATIVE_SCHEME = "com.chesskingdom.adventure";
export const LICHESS_NATIVE_REDIRECT = `${LICHESS_NATIVE_SCHEME}://lichess/callback`;
export const WEB_CALLBACK_PATH = "/lichess/callback";

/** How long a started authorization may take before it is refused. */
export const PENDING_TTL_MS = 10 * 60 * 1000;
const PENDING_KEY = "cm:lichess:pending";

export type PendingAuth = {
  verifier: string;
  state: string;
  childId: string;
  redirectUri: string;
  createdAt: number;
};

export function base64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

/** 43+ chars as Lichess requires (32 random bytes -> 43 base64url chars). */
export function createVerifier(): string {
  return randomToken(32);
}

export function createState(): string {
  return randomToken(16);
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function redirectUriFor(native: boolean, origin: string): string {
  return native ? LICHESS_NATIVE_REDIRECT : `${origin}${WEB_CALLBACK_PATH}`;
}

export function buildAuthorizeUrl(p: { challenge: string; state: string; redirectUri: string }): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: LICHESS_CLIENT_ID,
    redirect_uri: p.redirectUri,
    code_challenge_method: "S256",
    code_challenge: p.challenge,
    scope: LICHESS_SCOPE,
    state: p.state,
  });
  return `${LICHESS_ORIGIN}/oauth?${q.toString()}`;
}

// ---- pending authorization (survives the system-browser round trip on Android: same WebView storage) -------------------------------------

export function savePending(p: PendingAuth): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: the callback will report it cannot verify the request */
  }
}

/** Reads AND removes the pending authorization: it can be used once. */
export function takePending(): PendingAuth | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingAuth;
    if (!p || typeof p.verifier !== "string" || typeof p.state !== "string" || typeof p.childId !== "string") return null;
    return p;
  } catch {
    return null;
  }
}

export type CallbackCheck = { ok: true } | { ok: false; reason: "no_pending" | "expired" | "state_mismatch" | "wrong_profile" | "denied" | "no_code" };

/** Pure decision: may this callback be exchanged? */
export function validateCallback(
  pending: PendingAuth | null,
  params: { code: string | null; state: string | null; error: string | null },
  activeChildId: string | null,
  now: number
): CallbackCheck {
  if (params.error) return { ok: false, reason: "denied" };
  if (!pending) return { ok: false, reason: "no_pending" };
  if (now - pending.createdAt > PENDING_TTL_MS) return { ok: false, reason: "expired" };
  if (!params.state || params.state !== pending.state) return { ok: false, reason: "state_mismatch" };
  if (!activeChildId || activeChildId !== pending.childId) return { ok: false, reason: "wrong_profile" };
  if (!params.code) return { ok: false, reason: "no_code" };
  return { ok: true };
}

// ---- Lichess HTTP (errors are deliberately generic: never echo a response body or a token) ---------------------------------------------

export class LichessAuthError extends Error {
  constructor(public kind: "network" | "rejected") {
    super(kind === "network" ? "Could not reach Lichess." : "Lichess did not accept the sign-in.");
  }
}

export async function exchangeCode(code: string, verifier: string, redirectUri: string): Promise<{ token: string; expiresInSec: number }> {
  let res: Response;
  try {
    res = await fetch(`${LICHESS_ORIGIN}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri,
        client_id: LICHESS_CLIENT_ID,
      }).toString(),
    });
  } catch {
    throw new LichessAuthError("network");
  }
  if (!res.ok) throw new LichessAuthError("rejected");
  let body: { access_token?: unknown; expires_in?: unknown };
  try {
    body = await res.json();
  } catch {
    throw new LichessAuthError("rejected");
  }
  if (typeof body.access_token !== "string" || !body.access_token) throw new LichessAuthError("rejected");
  return { token: body.access_token, expiresInSec: typeof body.expires_in === "number" ? body.expires_in : 0 };
}

export async function fetchAccountName(token: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${LICHESS_ORIGIN}/api/account`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new LichessAuthError("network");
  }
  if (!res.ok) throw new LichessAuthError("rejected");
  const body = (await res.json().catch(() => ({}))) as { username?: unknown };
  if (typeof body.username !== "string" || !body.username) throw new LichessAuthError("rejected");
  return body.username;
}

/** Best effort: the local connection is cleared whether or not Lichess answers. */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${LICHESS_ORIGIN}/api/token`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    return res.ok;
  } catch {
    return false;
  }
}
