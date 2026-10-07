import { Screen } from "@/components/layout/Screen";
import { WorldScope } from "@/components/layout/WorldScope";
import { DiscoverBody } from "@/components/discover/DiscoverBody";

/**
 * Discover: where chess came from, and the stories behind the pieces.
 *
 * The sections live in content/discoverIndex.ts (only real, existing content gets a link; the rest are "soon"). The composition is per
 * world (components/discover/DiscoverBody): Enchanted adventure, Atelier resource room, Classic library. A static server page: no data,
 * no auth, no entitlement logic here, exactly as before.
 */
export default function DiscoverPage() {
  return (
    <WorldScope>
      <Screen maxWidth="wide">
        <DiscoverBody />
      </Screen>
    </WorldScope>
  );
}
