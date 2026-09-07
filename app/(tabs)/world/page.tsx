import { TabPageShell } from "@/components/nav/TabPageShell";
import { TEXT } from "@/lib/designSystem";
import { WorldLocationSelector } from "@/components/world/WorldLocationSelector";

/**
 * Chess Mind World — the location index.
 *
 * A static server page inside the (tabs) group, so it inherits the normal app
 * chrome and needs no auth logic of its own: middleware already protects
 * everything outside PUBLIC_PATHS, exactly as for every other tab page.
 *
 * The selector below is the only client component, so choosing a location
 * costs one small island rather than making this whole page interactive.
 */
export const metadata = {
  title: "World — Chess Mind",
  description: "Play chess in extraordinary places around the world.",
};

export default function WorldPage() {
  return (
    <TabPageShell>
      <header className="flex flex-col gap-2">
        <p className="font-classic-body text-[11px] uppercase tracking-[0.2em] text-premium-gold/80">
          Chess Mind World
        </p>
        <h1 className={TEXT.display}>Choose Your Location</h1>
        <p className={`${TEXT.body} max-w-xl text-premium-ivory/70`}>
          Play chess in the world&rsquo;s most extraordinary places. Your surroundings change; the
          game never does.
        </p>
      </header>

      <div className="mt-6">
        <WorldLocationSelector />
      </div>
    </TabPageShell>
  );
}
