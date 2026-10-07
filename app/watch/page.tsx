import { Suspense } from "react";
import { Screen } from "@/components/layout/Screen";
import { WorldScope } from "@/components/layout/WorldScope";
import { WatchBody } from "@/components/watch/WatchBody";
import { Notice } from "@/components/watch/Parts";

/**
 * Watch: live chess from Lichess (see components/watch/WatchBody). Free for everyone and read-only: no entitlement, no moves. Like every
 * other app page it sits behind the session check in middleware.ts; Watch adds no auth of its own.
 */
export default function WatchPage() {
  return (
    <WorldScope>
      <Screen maxWidth="wide">
        <Suspense fallback={<Notice title="Finding live chess..." />}>
          <WatchBody />
        </Suspense>
      </Screen>
    </WorldScope>
  );
}
