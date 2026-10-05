"use client";

import { useEffect, useState } from "react";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { ForParentsLink } from "./ForParentsLink";
import { ageAudience, type AgeBand } from "@/lib/learner/experienceLevel";

/**
 * "For Parents" for pages that are static server components with no child in hand (Learn). It
 * resolves the active child's age_band on the client and then renders the shared ForParentsLink,
 * which hides itself for 18+. A failed or missing lookup falls back to showing the entry (unknown
 * age is never treated as adult). While resolving it reserves the entry's height, so the page does
 * not jump and an adult never sees the entry flash up.
 */
export function ForParentsEntry() {
  const [state, setState] = useState<{ done: boolean; ageBand: AgeBand | null }>({ done: false, ageBand: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let ageBand: AgeBand | null = null;
      try {
        const supabase = createClient();
        const user = await getVerifiedUser(supabase);
        if (user) {
          const res = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
          ageBand = res.child?.age_band ?? null;
        }
      } catch {
        ageBand = null;
      }
      if (!cancelled) setState({ done: true, ageBand });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state.done) return <div aria-hidden="true" className="min-h-[52px]" />;
  if (ageAudience(state.ageBand) === "adult") return null;
  return <ForParentsLink ageBand={state.ageBand} />;
}
