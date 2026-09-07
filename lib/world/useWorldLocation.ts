"use client";

import { useCallback, useEffect, useState } from "react";
import { getLocation, isPlayable, type WorldLocation } from "./locations";

/**
 * The player's chosen location.
 *
 * localStorage, not the database. The choice is presentational, per-device and
 * worthless to anyone else, so persisting it server-side would mean a schema
 * change, a migration and a round trip to remember a background — see the note
 * in lib/world/locations.ts about why the choice is deliberately local.
 *
 * Every read is wrapped: storage throws outright in some privacy modes, and a
 * decorative preference must never be able to take down a game screen.
 */
const STORAGE_KEY = "chessmind.world.location";

/** Fired on set() so every mounted consumer updates at once. `storage` only
 *  fires in OTHER tabs, so same-tab listeners need this. */
const CHANGE_EVENT = "chessmind:world-location";

function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function write(id: string | null) {
  try {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage unavailable — the choice simply will not persist */
  }
}

export interface WorldLocationState {
  /** The active location, or null for the normal Chess Mind game UI. */
  location: WorldLocation | null;
  /** False until the effect has read storage — used to avoid a first-paint
   *  flash of scenery before we know whether any is wanted. */
  ready: boolean;
  select: (id: string | null) => void;
}

export function useWorldLocation(): WorldLocationState {
  // Always starts null so server and client render the same first pass; the
  // effect below corrects it. Seeding from storage here would hydrate-mismatch.
  const [id, setId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setId(read());
    sync();
    setReady(true);

    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const select = useCallback((next: string | null) => {
    // Only a built location may be stored. A stale id from an older build, or
    // one hand-edited into storage, must not leave the game wrapped in a scene
    // that does not exist.
    const valid = next === null || isPlayable(getLocation(next));
    const value = valid ? next : null;
    write(value);
    setId(value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const location = getLocation(id);
  return {
    location: isPlayable(location) ? location : null,
    ready,
    select,
  };
}
