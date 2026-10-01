"use client";

import { PieceSetPicker } from "@/components/board/PieceSetPicker";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";

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
        return "/onboarding/opening";
      }}
    />
  );
}
