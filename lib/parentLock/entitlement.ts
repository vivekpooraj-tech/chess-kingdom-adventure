/**
 * Optional entitlement hook — Parent Lock is free for all parents in v1.
 * Premium gating can plug in here later without changing Chess Time logic.
 */
import type { PremiumState } from "@/lib/premium/entitlement";

export function canUseParentLock(_premium: PremiumState | null): boolean {
  return true;
}
