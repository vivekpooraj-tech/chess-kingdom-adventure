"use client";

import { useEffect, useState } from "react";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";

export interface TrainChild {
  childId: string | null;
  boardSkinId?: string;
  pieceSetId?: string;
  /** True once resolution finished, whether or not a child was found. */
  resolved: boolean;
}

/**
 * Resolve the active child once for a Train Your Mind page. Best-effort: a
 * signed-out visitor or a failed lookup still resolves (with no child), so the
 * drill never waits forever.
 */
export function useTrainChild(): TrainChild {
  const [state, setState] = useState<TrainChild>({ childId: null, resolved: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const user = await getVerifiedUser(supabase);
        if (!user) return;
        const res = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
        if (!cancelled && res.child) {
          setState({
            childId: res.child.id,
            boardSkinId: res.child.board_skin_id,
            pieceSetId: res.child.piece_set_id,
            resolved: true,
          });
        }
      } catch {
        /* fall through: resolved with no child */
      } finally {
        if (!cancelled) setState((s) => (s.resolved ? s : { ...s, resolved: true }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
