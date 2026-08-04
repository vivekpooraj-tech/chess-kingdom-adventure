"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild, createOnlineGame } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { Button } from "@/components/ui/Button";

export function InviteFriendButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/sign-in");
      return;
    }
    const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
    if (resolution.needsSelection) {
      router.push("/choose-child");
      return;
    }
    const game = await createOnlineGame(supabase, resolution.child!.id);
    router.push(`/online/${game.id}`);
  }

  return (
    <Button onClick={handleClick} disabled={loading}>
      {loading ? "Creating..." : "Invite a Friend to Play →"}
    </Button>
  );
}
