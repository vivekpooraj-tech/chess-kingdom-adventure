"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

export interface MemoryFlipPair {
  id: string;
  glyph: string;
}

export interface MemoryFlipConfig {
  /** The prompt shown at the top, e.g. "Find the matching Knights!" */
  prompt: string;
  /** One entry per pair — the engine duplicates each into two cards and shuffles. */
  pairs: MemoryFlipPair[];
  onComplete: (success: boolean) => void;
}

interface Card {
  cardId: string; // unique per physical card
  pairId: string; // shared between the two cards of a pair
  glyph: string;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Config-driven mechanic engine powering "Knight Memory Match", "Queen's
 * Memory Vault", "Light Square Dark Square", "Full Board Vision" etc. from
 * the mini-game catalog (content/minigame-catalog.ts) — same pattern as
 * DragToTarget: one component, many content variations.
 */
export function MemoryFlip({ prompt, pairs, onComplete }: MemoryFlipConfig) {
  const cards = useMemo<Card[]>(() => {
    const doubled = pairs.flatMap((p, i) => [
      { cardId: `${p.id}-a`, pairId: p.id, glyph: p.glyph },
      { cardId: `${p.id}-b`, pairId: p.id, glyph: p.glyph },
    ]);
    return shuffle(doubled);
  }, [pairs]);

  const [flipped, setFlipped] = useState<string[]>([]); // cardIds currently face-up (max 2)
  const [matched, setMatched] = useState<Set<string>>(new Set()); // pairIds solved
  const [locked, setLocked] = useState(false); // true while a mismatched pair is briefly shown

  useEffect(() => {
    if (matched.size === pairs.length) {
      const t = setTimeout(() => onComplete(true), 500);
      return () => clearTimeout(t);
    }
  }, [matched, pairs.length, onComplete]);

  function handleFlip(card: Card) {
    if (locked) return;
    if (flipped.includes(card.cardId)) return;
    if (matched.has(card.pairId)) return;
    if (flipped.length === 2) return;

    const next = [...flipped, card.cardId];
    setFlipped(next);

    if (next.length === 2) {
      const [firstId, secondId] = next;
      const first = cards.find((c) => c.cardId === firstId)!;
      const second = cards.find((c) => c.cardId === secondId)!;

      if (first.pairId === second.pairId) {
        setMatched((m) => new Set(m).add(first.pairId));
        setFlipped([]);
      } else {
        setLocked(true);
        setTimeout(() => {
          setFlipped([]);
          setLocked(false);
        }, 700);
      }
    }
  }

  const cols = Math.min(cards.length, 4);

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="font-display text-2xl text-kingdom-night text-center">{prompt}</p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, 64px)` }}
      >
        {cards.map((card) => {
          const isFaceUp = flipped.includes(card.cardId) || matched.has(card.pairId);
          return (
            <button
              key={card.cardId}
              onClick={() => handleFlip(card)}
              className="relative"
              style={{ width: 64, height: 64, perspective: 400 }}
            >
              <motion.div
                className={clsx(
                  "absolute inset-0 rounded-md flex items-center justify-center text-3xl",
                  isFaceUp ? "bg-white shadow-toy" : "bg-kingdom-royal/80"
                )}
                animate={{ rotateY: isFaceUp ? 0 : 180 }}
                transition={{ duration: 0.3 }}
                style={{ backfaceVisibility: "hidden" }}
              >
                {isFaceUp ? card.glyph : ""}
              </motion.div>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {matched.size === pairs.length && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-xl text-kingdom-forest"
          >
            All matched! Amazing memory! 🎉
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}