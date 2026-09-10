"use client";

import { TabPageShell } from "@/components/nav/TabPageShell";
import { ChessTimeHomePanel } from "@/components/parentLock/ParentLockSettings";
import { useChessTime } from "@/components/parentLock/ChessTimeProvider";
import { TEXT } from "@/lib/designSystem";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ChessTimePage() {
  const { session } = useChessTime();
  const router = useRouter();
  /** Avoid redirecting before ChessTimeProvider loads localStorage on mount. */
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!session?.active) {
      router.replace("/kingdom-map");
    }
  }, [hydrated, session, router]);

  if (!hydrated || !session?.active) {
    return (
      <main className="min-h-screen bg-premium-midnight flex items-center justify-center px-6">
        <p className={TEXT.body}>Loading…</p>
      </main>
    );
  }

  return (
    <TabPageShell maxWidth="medium">
      <ChessTimeHomePanel />
      <p className={`${TEXT.caption} normal-case text-center`}>
        Focus Mode keeps Chess Mind focused. For stronger device-level focus, ask a parent to enable
        Screen Pinning on your tablet.
      </p>
      <Link
        href="/parent-gate?next=/parent-dashboard/parent-lock"
        className={`${TEXT.caption} normal-case text-center underline underline-offset-4 text-premium-ivory/50`}
      >
        Parent settings
      </Link>
    </TabPageShell>
  );
}
