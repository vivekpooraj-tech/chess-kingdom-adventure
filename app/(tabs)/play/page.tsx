import { WorldScope } from "@/components/layout/WorldScope";
import { WorldBranch } from "@/components/layout/WorldBranch";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { EnchantedPlay } from "@/components/play/EnchantedPlay";
import { AtelierPlay } from "@/components/play/AtelierPlay";
import { ClassicPlay } from "@/components/play/ClassicPlay";

/**
 * Play — the landing page before a game starts. It is scoped to the active world exactly like Home: WorldScope
 * puts the world's palette (and atmosphere) on the page, and WorldBranch renders that world's own layout.
 * Enchanted Kingdom ("Choose Your Quest"), Master Training Atelier ("Match Training") and Classic Pro ("Play")
 * each present the SAME destinations (components/play/playLanding.ts) in their own visual language.
 *
 * Only the presentation branches. Every destination (computer match, online match, tournaments, Chess Mind
 * World, invite a friend, the daily challenge) is the same shared route/component in all three worlds, and the
 * game arenas behind them keep their own world presentations.
 *
 * Still a static server page: no auth check and no server-side data of its own.
 */
export default function PlayPage() {
  return (
    <WorldScope>
      <TabPageShell maxWidth="wide">
        <WorldBranch classic={<ClassicPlay />} atelier={<AtelierPlay />} other={<EnchantedPlay />} />
      </TabPageShell>
    </WorldScope>
  );
}
