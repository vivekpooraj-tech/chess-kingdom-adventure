"use client";

import { useEffect, useState } from "react";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { WorldScope } from "@/components/layout/WorldScope";
import { WorldBody } from "@/components/world/WorldBody";
import { WORLD_LOCATIONS, type WorldLocation } from "@/lib/world/locations";
import {
  readPassport,
  recordVisit,
  totalGames,
  playedLocations,
  lastPlayed,
  worldAchievements,
  readSelectedLocation,
  writeSelectedLocation,
  type Passport,
} from "@/lib/world/passport";

/**
 * Chess Mind World.
 *
 * Two locations, both real, both finished. There is deliberately no row of
 * locked "coming soon" cards: a lock implies a progression system, and there
 * isn't one, so a locked card would be a promise the app cannot keep.
 *
 * The passport below shows only what actually happened — where a game was
 * really started, and how many. Opening this page records a visit; it does
 * not record a game, and nothing here is awarded for looking.
 *
 * A client page because the passport lives in localStorage (per device — see
 * lib/world/passport.ts, which says plainly why). It renders its full shell
 * on the first paint with an empty passport and fills the numbers in after,
 * so there is no hydration mismatch and no blank screen.
 *
 * The presentation (Enchanted realm portals, Atelier editorial pair, Classic rooms) is components/world/WorldBody; this page keeps all the
 * state: the passport, the favourite, the visit recording and the derived counts.
 */
export default function WorldPage() {
  const [passport, setPassport] = useState<Passport>({});
  const [favourite, setFavourite] = useState<WorldLocation["id"] | null>(null);

  useEffect(() => {
    setPassport(readPassport());
    setFavourite(readSelectedLocation());
  }, []);

  const played = playedLocations(passport);
  const games = totalGames(passport);
  const recent = lastPlayed(passport);
  const recentLocation = WORLD_LOCATIONS.find((l) => l.id === recent) ?? null;
  const achievements = worldAchievements(passport);

  function toggleFavourite(id: WorldLocation["id"]) {
    const next = favourite === id ? null : id;
    setFavourite(next);
    writeSelectedLocation(next);
  }

  return (
    <WorldScope>
      <TabPageShell maxWidth="wide">
        <WorldBody
          locations={WORLD_LOCATIONS}
          passport={passport}
          favourite={favourite}
          onVisit={(id) => setPassport(recordVisit(id))}
          onToggleFavourite={toggleFavourite}
          games={games}
          playedCount={played.length}
          recentLocation={recentLocation}
          achievements={achievements}
        />
      </TabPageShell>
    </WorldScope>
  );
}
