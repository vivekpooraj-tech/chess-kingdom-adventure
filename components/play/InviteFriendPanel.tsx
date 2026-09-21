import { InviteFriendButton } from "@/components/multiplayer/InviteFriendButton";
import { SecondaryCard } from "@/components/ui/Card";
import { PersonAddIcon } from "@/components/nav/icons";
import { TEXT } from "@/lib/designSystem";

/**
 * The "Invite a Friend" panel, factored out of app/(tabs)/play/page.tsx so
 * all three Play mode compositions can reuse the same InviteFriendButton
 * wiring (game type + time control + create_invite_game) with only their
 * own copy — no invite/game-creation logic is duplicated per mode.
 */
export function InviteFriendPanel({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <SecondaryCard className={`w-full flex flex-col gap-3 ${className ?? ""}`}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-premiumBtn bg-premium-gold/15 text-premium-gold flex items-center justify-center flex-none">
          <PersonAddIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-classic-body text-sm text-premium-ivory">{title}</p>
          <p className={TEXT.caption}>{description}</p>
        </div>
      </div>
      <InviteFriendButton />
    </SecondaryCard>
  );
}
