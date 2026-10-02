"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  clearActiveChildIdClient,
  markExplicitSignOutClient,
} from "@/lib/childSession";

/**
 * There was no sign-out control anywhere in the app before this redesign
 * (grepped the whole tree for signOut/sign-out — zero hits) — a real,
 * pre-existing gap, not something the redesign is inventing for its own
 * sake. Client-side only (supabase.auth.signOut() + redirect), the
 * standard, already-established auth pattern this app uses everywhere
 * else — no new backend surface.
 */
export function SignOutRow() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setLoading(false);
      setError("Couldn't sign out. Please try again.");
      return;
    }

    clearActiveChildIdClient();
    markExplicitSignOutClient();

    // Hard navigation so middleware and Server Components see cleared auth
    // cookies immediately — client-side router.push alone left a stale session
    // visible and, in LOCAL_TEST_MODE, bounced straight into dev auto-signin.
    window.location.assign("/sign-in");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        className="w-full flex items-center gap-3 rounded-premiumBtn bg-premium-navy/60 hover:bg-premium-navy active:bg-premium-navy active:scale-[0.98] px-4 py-3.5 min-h-[48px] transition-[background-color,transform] duration-100 text-left disabled:opacity-50"
      >
        <span className="text-xl flex-none">🚪</span>
        <span className="font-classic-display text-sm text-red-300">
          {loading ? "Signing out..." : "Sign Out"}
        </span>
      </button>
      {error && (
        <p className="font-classic-body text-xs text-red-300/90 px-1">{error}</p>
      )}
    </div>
  );
}
