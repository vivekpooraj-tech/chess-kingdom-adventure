"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * There was no sign-out control anywhere in the app before this redesign
 * (grepped the whole tree for signOut/sign-out — zero hits) — a real,
 * pre-existing gap, not something the redesign is inventing for its own
 * sake. Client-side only (supabase.auth.signOut() + redirect), the
 * standard, already-established auth pattern this app uses everywhere
 * else — no new backend surface.
 */
export function SignOutRow() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
  }

  return (
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
  );
}
