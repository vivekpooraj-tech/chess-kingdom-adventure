"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { worldFromMode } from "@/lib/world/worlds";

/**
 * Gives a page that is NOT wrapped in WorldScope a dedicated Master Training Atelier layout, while
 * Enchanted Kingdom and Classic Pro keep the page they already have, untouched.
 *
 * WorldBranch needs a WorldScope (which also repaints the page in the world's tokens). Learn is
 * deliberately left out of WorldScope so the other two worlds do not change, so this reads the
 * presentation mode itself: `html[data-mode="adult"]` is Atelier (worldFromMode).
 *
 * The server cannot know the mode, so both trees are in the HTML and CSS (worlds.css, `.world-branch--ta-*`)
 * hides the wrong one before first paint; once mounted the other tree is dropped. Islands inside the Atelier
 * tree read `useAtelierBranchActive()` so they do not fetch for a viewer who will never see them.
 */
const AtelierBranchActive = createContext(true);

/** False only while an Atelier subtree is rendered for a viewer who is not (or not yet known to be) in Atelier. */
export function useAtelierBranchActive(): boolean {
  return useContext(AtelierBranchActive);
}

// useLayoutEffect warns during server rendering; this hook is a plain effect there.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function AtelierBranch({ atelier, children }: { atelier: ReactNode; children: ReactNode }) {
  const [isAtelier, setIsAtelier] = useState<boolean | null>(null);

  useIsoLayoutEffect(() => {
    setIsAtelier(worldFromMode(document.documentElement.getAttribute("data-mode")) === "atelier");
  }, []);

  return (
    <>
      <div className="world-branch world-branch--ta-rest">{isAtelier === true ? null : children}</div>
      <div className="world-branch world-branch--ta-atelier">
        <AtelierBranchActive.Provider value={isAtelier === true}>
          {isAtelier === false ? null : atelier}
        </AtelierBranchActive.Provider>
      </div>
    </>
  );
}
