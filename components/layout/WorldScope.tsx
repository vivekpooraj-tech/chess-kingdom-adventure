"use client";

import { useEffect, useState, type ReactNode } from "react";
import { WorldContext, WorldResolvedContext } from "@/lib/world/WorldContext";
import {
  DEFAULT_WORLD,
  worldFromMode,
  type WorldId,
} from "@/lib/world/worlds";

/**
 * Scopes Chess Mind's three-world visual tokens to a page subtree.
 * Does not change routing, data, or chrome outside `children`.
 *
 * `world` pins the subtree (used for ?world= QA). When omitted, Home follows
 * presentation mode: kids → enchanted, adult → atelier, classic-pro → classic.
 */
export function WorldScope({
  world: pinned,
  children,
  fit = "page",
}: {
  world?: WorldId;
  children: ReactNode;
  /** Play arenas are `position:fixed`; `contents` keeps tokens without a wrapping box. */
  fit?: "page" | "play";
}) {
  const [world, setWorld] = useState<WorldId>(pinned ?? DEFAULT_WORLD);
  const [resolved, setResolved] = useState(Boolean(pinned));

  useEffect(() => {
    if (pinned) {
      setWorld(pinned);
    } else {
      const mode = document.documentElement.getAttribute("data-mode");
      setWorld(worldFromMode(mode));
    }
    setResolved(true);
  }, [pinned]);

  return (
    <WorldContext.Provider value={world}>
      <WorldResolvedContext.Provider value={resolved}>
        <div
          data-world={world}
          data-world-resolved={resolved ? "" : undefined}
          className={fit === "play" ? "world-scope world-scope--play" : "world-scope"}
        >
          {fit !== "play" && <div className="world-scope__atmosphere" aria-hidden="true" />}
          {children}
        </div>
      </WorldResolvedContext.Provider>
    </WorldContext.Provider>
  );
}
