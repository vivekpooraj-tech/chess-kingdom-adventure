import Stripe from "stripe";

// Only ever imported from server-side code (Route Handlers) — never expose
// STRIPE_SECRET_KEY to the client.
//
// Constructed lazily (not at module load) because the Stripe SDK validates
// its API key immediately in the constructor — instantiating it at import
// time would crash `next build`'s page-data collection step whenever
// STRIPE_SECRET_KEY isn't set yet (e.g. before you've added real Stripe
// keys to .env.local). Deferring to first actual use avoids that entirely.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (see README) before using checkout."
    );
  }

  _stripe = new Stripe(apiKey, { apiVersion: "2026-06-24.dahlia" });
  return _stripe;
}
