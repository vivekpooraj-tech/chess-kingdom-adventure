"use client";

import { useEffect, useRef } from "react";

export function MoveList({ history }: { history: string[] }) {
  const scrollRef = useRef<HTMLOListElement | null>(null);

  // Keep the most recent move in view as the game grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

  const pairs: [string, string | undefined][] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push([history[i], history[i + 1]]);
  }

  if (pairs.length === 0) {
    return (
      <p className="rounded-premiumBtn bg-white/[0.03] px-3 py-4 text-center font-classic-body text-xs italic text-premium-ivory/35">
        Moves will appear here as you play
      </p>
    );
  }

  const lastPlyIndex = history.length - 1; // 0-based; even = white, odd = black

  return (
    <ol
      ref={scrollRef}
      className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto rounded-premiumBtn bg-black/15 p-1.5 font-classic-body text-xs [max-height:min(60vh,32rem)] [min-height:4rem]"
    >
      {pairs.map(([white, black], i) => {
        const whiteIsLast = i * 2 === lastPlyIndex;
        const blackIsLast = i * 2 + 1 === lastPlyIndex;
        return (
          <li key={i} className="flex items-center gap-2 rounded px-1.5 py-0.5 text-premium-ivory/75">
            <span className="w-5 flex-none tabular-nums text-premium-ivory/30">{i + 1}.</span>
            <span
              className={
                "w-16 rounded px-1 " +
                (whiteIsLast ? "bg-premium-gold/20 font-semibold text-premium-gold" : "")
              }
            >
              {white}
            </span>
            <span
              className={
                "w-16 rounded px-1 " +
                (blackIsLast ? "bg-premium-gold/20 font-semibold text-premium-gold" : "")
              }
            >
              {black ?? ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
