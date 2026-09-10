"use client";

import Link from "next/link";
import { Screen } from "@/components/layout/Screen";
import { ParentLockSettings } from "@/components/parentLock/ParentLockSettings";
import { TEXT } from "@/lib/designSystem";

export default function ParentLockDashboardPage() {
  return (
    <Screen maxWidth="compact">
      <div className="sticky top-0 z-30 -mx-[var(--screen-gutter)] px-[var(--screen-gutter)] bg-premium-midnight/95 backdrop-blur-md border-b border-premium-gold/15 mb-3">
        <Link
          href="/parent-dashboard"
          className="inline-flex items-center gap-2 min-h-[48px] font-classic-body text-sm font-semibold text-premium-gold hover:text-premium-ivory transition-colors"
        >
          <span aria-hidden>←</span>
          <span>Back to Parent Dashboard</span>
        </Link>
      </div>
      <h1 className={`${TEXT.display} sr-only`}>Parent Lock</h1>
      <ParentLockSettings />
    </Screen>
  );
}
