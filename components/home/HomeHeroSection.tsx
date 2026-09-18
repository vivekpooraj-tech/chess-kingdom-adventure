import { OllieNote } from "@/components/ollie/OllieNote";
import { PrimaryActionCard } from "@/components/home/PrimaryActionCard";
import type { BuddyOption } from "@/lib/types";
import type { PrimaryAction } from "@/lib/home/getPrimaryAction";

/**
 * Home hero — Ollie coach line plus the single primary action card. Chess
 * School stays the dominant CTA when getPrimaryAction() says so.
 */
export function HomeHeroSection({
  action,
  buddy,
  ollieLine,
}: {
  action: PrimaryAction;
  buddy: BuddyOption;
  ollieLine: string;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <OllieNote buddyEmoji={buddy.emoji}>{ollieLine}</OllieNote>
      <PrimaryActionCard action={action} />
    </div>
  );
}
