"use client";

import { useWorld } from "@/lib/world/WorldContext";
import { schoolArenaTitle } from "@/lib/school/schoolArena";

export function SchoolArenaHeading() {
  return <>{schoolArenaTitle(useWorld())}</>;
}
