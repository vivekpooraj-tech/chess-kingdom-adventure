import { OllieModeLine } from "@/components/home/OllieModeLine";
import { PrimaryActionCard } from "@/components/home/PrimaryActionCard";
import type { BuddyOption } from "@/lib/types";
import type { PrimaryAction } from "@/lib/home/getPrimaryAction";

/**
 * Home hero — Ollie coach line plus the single primary action card. Chess
 * School stays the dominant CTA when getPrimaryAction() says so.
 *
 * `ollieLine` is the server-computed classic-pro text (unchanged); the
 * mode-aware re-tone (kids/adult) happens client-side in OllieModeLine — see
 * its own doc comment for why this can't happen on the server.
 */
export function HomeHeroSection({
  action,
  buddy,
  ollieLine,
  neutralTone,
}: {
  action: PrimaryAction;
  buddy: BuddyOption;
  ollieLine: string;
  neutralTone: boolean;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <OllieModeLine action={action} buddy={buddy} neutralTone={neutralTone} defaultLine={ollieLine} />
      <PrimaryActionCard action={action} />
    </div>
  );
}
