"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { RegionalPrice } from "@/lib/pricing/regions";

interface PromoPreview {
  code: string;
  display: { original: string; discount: string; final: string };
}

export function UpgradeButton({
  label,
  tone = "adventure",
}: {
  /** Full custom button text (no price appended). Omit to show the
   * server-determined regional price: "Unlock Everything — ₹299". */
  label?: string;
  tone?: "adventure" | "premium";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<RegionalPrice | null>(null);

  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoPreview, setPromoPreview] = useState<PromoPreview | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pricing")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setPrice(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function applyPromoCode() {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError(null);
    setPromoPreview(null);
    try {
      const res = await fetch("/api/stripe/validate-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode }),
      });
      const data = await res.json();
      if (data.valid) {
        setPromoPreview({ code: data.preview.code, display: data.preview.display });
      } else {
        setPromoError(data.message ?? "Invalid or expired discount code.");
      }
    } catch {
      setPromoError("Invalid or expired discount code.");
    } finally {
      setPromoLoading(false);
    }
  }

  function removePromoCode() {
    setPromoPreview(null);
    setPromoCode("");
    setPromoError(null);
  }

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoCode: promoPreview?.code }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Couldn't start checkout.");
        setLoading(false);
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
      setLoading(false);
    }
  }

  const errorTextClass =
    tone === "premium" ? "font-classic-body text-sm text-red-300" : "font-body text-sm text-kingdom-coral";
  const mutedTextClass =
    tone === "premium" ? "font-classic-body text-xs text-premium-ivory/50" : "font-body text-xs text-kingdom-night/50";
  const linkClass =
    tone === "premium"
      ? "font-classic-body text-xs text-premium-gold underline underline-offset-2"
      : "font-body text-xs text-kingdom-night/60 underline underline-offset-2";
  const inputClass =
    tone === "premium"
      ? "rounded-premiumBtn px-3 py-1.5 text-sm border border-white/15 bg-premium-midnightDeep text-premium-ivory font-classic-body"
      : "rounded-btn px-3 py-1.5 text-sm border-2 border-kingdom-night/10 font-body";

  const buttonLabel = label ?? `Unlock Everything${price ? ` — ${price.display}` : ""}`;
  // A custom `label` (e.g. "Unlock Full Journey →") replaces the price in
  // the button text itself — show the price as its own line just above the
  // discount-code section so "below the price" holds regardless of which
  // button text is in use.
  const priceShownInButton = !label;

  return (
    <div className="flex flex-col items-center gap-2">
      <Button tone={tone} onClick={startCheckout} disabled={loading}>
        {loading ? "Starting checkout..." : buttonLabel}
      </Button>
      {error && <p className={errorTextClass}>{error}</p>}

      <div className="flex flex-col items-center gap-2 mt-1">
        {!priceShownInButton && price && !promoPreview && (
          <p className={tone === "premium" ? "font-classic-display text-lg text-premium-gold" : "font-display text-lg text-kingdom-night"}>
            {price.display}
          </p>
        )}
        <div className="flex flex-col items-center gap-2">
          {promoPreview ? (
            <div className="flex flex-col items-center gap-0.5 text-center">
              <p className={mutedTextClass}>Original price: {promoPreview.display.original}</p>
              <p className={mutedTextClass}>Discount: -{promoPreview.display.discount}</p>
              <p className={tone === "premium" ? "font-classic-body text-sm text-premium-gold" : "font-body text-sm text-kingdom-forest"}>
                You pay: {promoPreview.display.final}
              </p>
              <button type="button" onClick={removePromoCode} className={linkClass}>
                Remove code
              </button>
            </div>
          ) : promoOpen ? (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Enter code"
                  aria-label="Discount code"
                  className={inputClass}
                />
                <Button
                  tone={tone}
                  variant="ghost"
                  size="md"
                  onClick={applyPromoCode}
                  disabled={promoLoading || !promoCode.trim()}
                >
                  {promoLoading ? "Checking..." : "Apply"}
                </Button>
              </div>
              {promoError && <p className={errorTextClass}>{promoError}</p>}
            </div>
          ) : (
            <button type="button" onClick={() => setPromoOpen(true)} className={linkClass}>
              Have a discount code?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
