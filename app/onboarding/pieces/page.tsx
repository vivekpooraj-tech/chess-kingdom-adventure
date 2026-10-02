"use client";

import { PieceSetPicker } from "@/components/board/PieceSetPicker";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { track } from "@/lib/analytics/client";

export default function OnboardingPiecesPage() {
  return (
    <PieceSetPicker
      heading="Pick your pieces"
      confirmLabel="Continue →"
      resolveRedirectTo={async () => {
        const supabase = createClient();
        const user = await getVerifiedUser(supabase);
        if (!user) return "/sign-in";
        const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
        const child = resolution.child;
        if (!child) return "/choose-child";
        track("onboarding_completed");
        return "/onboarding/opening";
      }}
    />
  );
}
