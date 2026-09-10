"use client";

import { ChessTimeProvider } from "@/components/parentLock/ChessTimeProvider";
import { ChessTimeBanner } from "@/components/parentLock/ChessTimeBanner";

/**
 * Wraps the app with Chess Time state + route protection + top banner.
 * Sibling to AppShell so focus works on full-screen routes too.
 */
export function ParentLockShell({ children }: { children: React.ReactNode }) {
  return (
    <ChessTimeProvider>
      <ChessTimeBanner />
      {children}
    </ChessTimeProvider>
  );
}
