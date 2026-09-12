"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { FREE_SESSION_LIMIT, SCHOOL_PRICE_LABEL, SCHOOL_PRICE_NOTE } from "@/lib/school/v2/access";

/**
 * The Chess School upgrade path, shown wherever a locked session is.
 *
 * Two ways in, both stated plainly: buy Chess School on its own (lifetime,
 * one payment), or get Premium, which includes it. The price shown comes from
 * /api/pricing/school so it matches what Stripe will charge for this
 * region; the server-rendered fallback is the Indian price, which is the
 * requested one.
 *
 * Same shape as components/upgrade/UpgradeButton: the client only ever asks
 * the server to start a checkout and is sent to Stripe's hosted page. No
 * amount, currency or product is chosen here.
 */
export function UnlockSchoolButton({ nextSessionNumber }: { nextSessionNumber: number }) {
  const [priceLabel, setPriceLabel] = useState(SCHOOL_PRICE_LABEL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pricing/school")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!cancelled && p && typeof p.display === "string") setPriceLabel(p.display);
      })
      .catch(() => {
        /* keep the fallback label */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout-school", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Couldn't start checkout.");
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setLoading(false);
  }

  return (
    <div className="rounded-premiumCard border border-premium-gold/30 bg-premium-gold/[0.06] p-5">
      <p className={`${TEXT.subheading}`}>Session {nextSessionNumber} is waiting</p>
      <p className={`${TEXT.body} mt-1`}>
        The first {FREE_SESSION_LIMIT} sessions are free. Unlock all thirty for {priceLabel}.
      </p>
      <p className={`${TEXT.caption} mt-1`}>{SCHOOL_PRICE_NOTE}</p>

      <ul className="mt-3 space-y-1">
        {[
          "All 30 sessions, at your own pace — nothing expires",
          "Ollie coaching you through every one",
          "Parent Mode and pass-and-play, on this device",
          "Graduation Duel and a certificate with their name on it",
        ].map((line) => (
          <li key={line} className={`${TEXT.caption} flex gap-2 text-premium-ivory/75`}>
            <span aria-hidden="true" className="text-premium-gold">✓</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <Button tone="premium" block size="lg" className="mt-4" onClick={startCheckout} loading={loading}>
        Chess School Lifetime Access — {priceLabel}
      </Button>
      {error ? <p className="mt-2 font-classic-body text-sm text-red-300">{error}</p> : null}

      <Link
        href="/upgrade"
        className={`${TEXT.caption} mt-3 block text-center underline underline-offset-2 hover:text-premium-gold`}
      >
        Or get Premium — it includes Chess School, forever
      </Link>
    </div>
  );
}
