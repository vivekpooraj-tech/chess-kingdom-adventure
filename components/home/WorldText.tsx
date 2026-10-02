"use client";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { useWorld } from "@/lib/world/WorldContext";
import type { WorldId } from "@/lib/world/worlds";

type WorldCopy = {
  enchanted: string;
  atelier: string;
  classic: string;
};

function pick(world: WorldId, copy: WorldCopy): string {
  if (world === "atelier") return copy.atelier;
  if (world === "classic") return copy.classic;
  return copy.enchanted;
}

/** Presentation-only copy switch. Enchanted and Atelier strings stay byte-stable. */
export function WorldText(copy: WorldCopy) {
  const world = useWorld();
  return <>{pick(world, copy)}</>;
}

export function WorldSectionHeader(copy: WorldCopy) {
  const world = useWorld();
  return <SectionHeader title={pick(world, copy)} />;
}
