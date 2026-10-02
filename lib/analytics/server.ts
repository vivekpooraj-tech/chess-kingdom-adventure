import { PostHog } from "posthog-node";

/**
 * V1 P1 fix #4 — server-side analytics, used from exactly one place today:
 * app/api/stripe/webhook/route.ts, to fire the two purchase-success events
 * only after the existing, unmodified grant_premium_entitlement()/
 * grant_school_entitlement() RPCs have already succeeded. This is
 * deliberately the ONLY writer of these two events — see that file's
 * comments for why the client-reachable /upgrade/success page never fires
 * them (a client-side "purchase succeeded" signal is never proof of
 * payment).
 *
 * Same fail-safe contract as lib/analytics/client.ts: no PostHog project
 * configured (every dev/test environment today) means every call is a
 * silent no-op, never a thrown error, never a webhook failure.
 *
 * A fresh, short-lived client per call (not a cached singleton) — Route
 * Handlers can run in a long-lived Node process, and posthog-node's
 * shutdown() permanently closes a client, so reusing one across
 * invocations would break the second call. One webhook delivery is cheap
 * enough that this costs nothing meaningful.
 */
export type ServerAnalyticsEventName = "premium_purchase_success" | "school_purchase_success";

export interface ServerAnalyticsProperties {
  product: "premium" | "chess_school";
  /** ISO 4217 currency code as Stripe reports it (e.g. "inr") — never a
   * card number or any payment-method detail. */
  currency?: string;
  /** Minor-unit amount actually charged, exactly as Stripe reports it. */
  amount?: number;
}

export async function trackServerEvent(
  distinctId: string,
  event: ServerAnalyticsEventName,
  properties: ServerAnalyticsProperties
): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) return; // not configured — analytics stays off

  let client: PostHog | null = null;
  try {
    client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
    client.capture({ distinctId, event, properties });
    await client.shutdown();
  } catch {
    // analytics must never break a webhook that already granted a real
    // entitlement — never rethrow here.
    try {
      await client?.shutdown();
    } catch {
      /* already failing; nothing more to do */
    }
  }
}
