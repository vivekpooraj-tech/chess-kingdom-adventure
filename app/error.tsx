"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TEXT } from "@/lib/designSystem";

/**
 * Phase 8A — root error boundary.
 *
 * Next.js App Router convention: this file catches any otherwise-uncaught
 * render/throw error from a page under the root layout and replaces it with
 * this UI instead of the framework's default error screen. Without this
 * file, ANY uncaught error anywhere in the app (a bad prop, a null-deref, a
 * failed fetch a page didn't guard) showed Next's generic developer error
 * page to the child/parent using it — there was previously no custom
 * handling anywhere in the app (see the V1 audit).
 *
 * Deliberately self-contained: no app-shell chrome, no data fetching, no
 * dependency on anything that could itself be the thing that broke (this
 * component must never throw). `error.tsx` is required by Next.js to be a
 * Client Component — it receives the error as a prop, it isn't one thrown by
 * this file.
 *
 * No technical detail (message, stack, digest) is ever rendered — logged to
 * the console only, exactly like the pattern this app already uses for
 * expected-to-fail reads elsewhere (fail closed, never surface internals to
 * a child).
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled app error:", error);
  }, [error]);

  return (
    <div className="min-h-screen w-full bg-premium-midnight flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
        <span className="text-5xl" aria-hidden="true">
          ♟️
        </span>
        <h1 className={TEXT.heading}>Oops, something slipped</h1>
        <p className={TEXT.body}>
          That move didn&apos;t go through. Nothing you did caused this — let&apos;s try again.
        </p>
        <div className="w-full flex flex-col gap-3 mt-2">
          <button
            type="button"
            onClick={reset}
            className="w-full min-h-[48px] rounded-full bg-premium-gold px-6 font-classic-body text-sm font-semibold text-premium-midnight active:scale-[0.98] transition-transform duration-100 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
          >
            Try again
          </button>
          <Link
            href="/kingdom-map"
            className="w-full min-h-[48px] flex items-center justify-center rounded-full border border-white/15 px-6 font-classic-body text-sm text-premium-ivory active:scale-[0.98] transition-transform duration-100 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
