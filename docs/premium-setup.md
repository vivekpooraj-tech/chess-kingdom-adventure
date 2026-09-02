# Premium / monetization — manual setup (Phase 15)

Phase 15 ships the code foundation. The following must be done by hand — no
secrets or Stripe IDs are committed.

## 1. Database — apply migration 0031

`supabase/migrations/0031_premium_entitlements.sql` is **not applied
automatically** (this repo's migrations are pasted into the Supabase SQL
Editor). Apply it to the production project **before deploying the Phase 15
app code** — several pages `select premium_expires_at`, and the Stripe
webhook calls `grant_premium_entitlement()`.

It adds: `parents.premium_expires_at`, `public.premium_entitlements`,
`parent_is_premium()`, `grant_premium_entitlement()` /
`revoke_premium_entitlement()` / `sync_premium_from_entitlements()`, and
re-creates `mark_lesson_complete` + the free-game RPCs to honour expiry.
Additive and idempotent; existing "forever" premium parents are grandfathered
(`premium_expires_at` stays NULL → still Premium).

## 2. Stripe

Already wired (checkout / webhook / success page existed pre-Phase-15). What
must exist in the Stripe **account**, not the code:

| Env var | Where | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Vercel + `.env.local` | already set |
| `STRIPE_WEBHOOK_SECRET` | Vercel + `.env.local` | already set — must match the endpoint below |

- **Webhook endpoint:** in the Stripe Dashboard, add an endpoint pointing at
  `https://<prod-domain>/api/stripe/webhook` subscribed to
  **`checkout.session.completed`** and **`charge.refunded`**. Copy its signing
  secret into `STRIPE_WEBHOOK_SECRET`.
- **Payment methods:** enable **UPI** (Dashboard → Settings → Payment methods)
  for the India ₹299 price to show Google Pay / PhonePe / Paytm at checkout.
- **No Product/Price object is needed** — checkout uses inline `price_data`
  with the regional amount from `lib/pricing/regions.ts` (₹299 for IN). Do not
  create or reference a Stripe Price ID.
- Pricing is a one-time payment (`mode: "payment"`). There is **no Stripe
  subscription** and none must be created.

## 3. Entitlement term

`PREMIUM_ENTITLEMENT_YEARS = 2` in `lib/premium/entitlement.ts` (mirrored by
`grant_premium_entitlement`'s `interval '2 years'` default). Change both
together if the term ever changes.

## 4. Ads

No ad provider/SDK is integrated. `lib/premium/ads.ts` (`shouldShowAds`,
`adsAllowedInContext`) is the gate a future provider plugs into. Nothing to
configure now.

## 5. Vercel

No new env vars beyond the two Stripe keys above (already present). Deploy is
the normal `git push` → Vercel build.
