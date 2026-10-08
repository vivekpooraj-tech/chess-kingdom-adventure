"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ListItemRow } from "@/components/ui/Card";
import { TEXT } from "@/lib/designSystem";
import { isLichessEligible } from "@/lib/lichess/eligibility";
import {
  buildAuthorizeUrl,
  challengeFor,
  createState,
  createVerifier,
  redirectUriFor,
  revokeToken,
  savePending,
} from "@/lib/lichess/oauth";
import { clearConnection, readConnection, readToken, type LichessConnection } from "@/lib/lichess/tokenStore";

/**
 * "Connect Lichess" on the More page: an OPTIONAL way for an adult (18+) profile to link their OWN Lichess account for more online
 * opponents later. Renders nothing at all unless the active profile is an adult, so minors and profiles with no age band never see it.
 * Phase 1 only connects and disconnects; nothing here changes matchmaking.
 */
export function LichessConnectRow({ childId, ageBand }: { childId: string; ageBand: string | null }) {
  const eligible = isLichessEligible(ageBand);
  const [conn, setConn] = useState<LichessConnection | null | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eligible) return;
    setConn(readConnection(childId));
  }, [childId, eligible]);

  if (!eligible) return null;

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const native = Capacitor.isNativePlatform();
      const redirectUri = redirectUriFor(native, window.location.origin);
      const verifier = createVerifier();
      const state = createState();
      savePending({ verifier, state, childId, redirectUri, createdAt: Date.now() });
      const url = buildAuthorizeUrl({ challenge: await challengeFor(verifier), state, redirectUri });
      if (native) {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url });
        setBusy(false);
      } else {
        window.location.assign(url);
      }
    } catch {
      setBusy(false);
      setError("Couldn't start the connection. Please try again.");
    }
  }

  async function disconnect() {
    setBusy(true);
    const token = readToken(childId);
    clearConnection(childId);
    setConn(null);
    if (token) await revokeToken(token);
    setBusy(false);
  }

  return (
    <section className="w-full flex flex-col gap-2" data-lichess-section>
      <p className={`${TEXT.caption} uppercase tracking-wide`}>Online</p>
      {conn === "loading" ? null : conn ? (
        <div className="list-row flex min-h-[3rem] items-center gap-3 rounded-premiumBtn bg-premium-navy/60 px-4 py-3" data-lichess-status="connected">
          <div className="flex-1">
            <p className="font-classic-display text-base text-premium-ivory">Lichess connected</p>
            <p className={`${TEXT.caption} normal-case`}>
              Signed in as <span data-lichess-username>{conn.username}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            data-lichess-disconnect
            className="min-h-[44px] rounded-premiumBtn border border-white/15 px-3 font-classic-body text-sm text-premium-ivory/80"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div data-lichess-connect>
          <ListItemRow onClick={busy ? undefined : connect}>
            <span className="text-2xl flex-none" aria-hidden="true">♞</span>
            <div className="flex-1">
              <p className="font-classic-display text-base text-premium-ivory">Connect Lichess</p>
              <p className={`${TEXT.caption} normal-case`}>Use your own Lichess account to find more online opponents</p>
            </div>
            <span className="text-premium-gold text-lg flex-none">→</span>
          </ListItemRow>
        </div>
      )}
      {error && (
        <p role="alert" className="font-classic-body text-sm text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
