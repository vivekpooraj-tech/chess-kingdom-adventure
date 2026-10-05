"use client";

import type { ReactNode } from "react";
import { useWorld, useWorldResolved } from "@/lib/world/WorldContext";

/**
 * Swaps a whole layout for Classic Pro while Enchanted / Atelier keep theirs.
 *
 * The server cannot know the world (it lives in `html[data-mode]`), so until
 * WorldScope resolves both trees are rendered and CSS in worlds.css hides the
 * one the pre-paint mode attribute rules out. Once resolved, the other tree
 * is dropped. Each tree keeps its wrapper position, so the visible one is
 * never remounted.
 */
export function WorldBranch({
  classic,
  other,
  atelier,
}: {
  classic: ReactNode;
  other: ReactNode;
  /** Optional dedicated Atelier layout. Without it, Atelier keeps sharing `other` with Enchanted Kingdom. */
  atelier?: ReactNode;
}) {
  const world = useWorld();
  const resolved = useWorldResolved();
  const isClassic = world === "classic";
  const isAtelier = world === "atelier" && atelier !== undefined;

  return (
    <>
      <div className="world-branch world-branch--classic">
        {!resolved || isClassic ? classic : null}
      </div>
      {atelier !== undefined && (
        <div className="world-branch world-branch--atelier">{!resolved || isAtelier ? atelier : null}</div>
      )}
      <div className={`world-branch world-branch--other${atelier !== undefined ? " world-branch--has-atelier" : ""}`}>
        {!resolved || (!isClassic && !isAtelier) ? other : null}
      </div>
    </>
  );
}
