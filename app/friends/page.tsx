import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import {
  resolveActiveChild,
  getFriends,
  getFriendCode,
  type FriendRow,
} from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { Screen } from "@/components/layout/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PrimaryCard } from "@/components/ui/Card";
import { TEXT } from "@/lib/designSystem";
import { EmptySection } from "@/components/stats/StatBlocks";
import { AddFriendBox, RespondButtons } from "@/components/community/FriendActions";

export const metadata = {
  title: "Friends · Chess Mind",
  description: "Add friends by code and challenge them to a game.",
};

/**
 * Friends.
 *
 * Two decisions shape this page, both driven by the fact that children use it.
 *
 * First, there is no player search. `children` is parent-owns-child under RLS,
 * and opening it up so players could browse each other would be the single most
 * damaging change this codebase could make. Friending is by CODE, shared out of
 * band, which means no one can be found by a stranger who does not already have
 * their code.
 *
 * Second, friendship grants exactly two things: a game, and a name. There is no
 * messaging, no feed, no comments. A chess friend list does not need free-text
 * communication between children to be useful, and adding it would create a
 * moderation problem this product has no way to answer.
 *
 * The page degrades honestly when migration 0034 has not been applied — it says
 * the feature is not switched on rather than erroring or pretending to work.
 */

function FriendRowItem({
  row,
  childId,
  kind,
}: {
  row: FriendRow;
  childId: string;
  kind: "incoming" | "outgoing" | "accepted";
}) {
  return (
    <li className="flex min-h-[64px] items-center gap-3 rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-4 py-3">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-classic-body text-sm text-premium-ivory">{row.friendName}</span>
        <span className={TEXT.caption}>
          {row.friendRating !== null ? `Rating ${row.friendRating}` : "Chess Mind player"}
        </span>
      </span>
      {kind === "accepted" && (
        <Link
          href="/play"
          className="flex min-h-[44px] flex-none items-center font-classic-body text-sm text-premium-gold underline underline-offset-4"
        >
          Challenge
        </Link>
      )}
      <RespondButtons childId={childId} friendshipId={row.friendshipId} kind={kind} />
    </li>
  );
}

export default async function FriendsPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");
  const child = resolution.child;
  if (!child) redirect("/choose-child");

  const [friends, myCode] = await Promise.all([
    getFriends(supabase, child.id),
    getFriendCode(supabase, child.id),
  ]);

  if (!friends.enabled) {
    return (
      <Screen maxWidth="compact">
        <header className="flex flex-col gap-2">
          <h1 className={TEXT.display}>Friends</h1>
        </header>
        <EmptySection>
          Friends are not switched on for this app yet. The database migration that adds them
          (0034_friendships.sql) has not been applied.
        </EmptySection>
        <Link
          href="/play"
          className="flex min-h-[52px] items-center justify-between rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-4 font-classic-body text-sm text-premium-ivory"
        >
          Play a game <span aria-hidden="true">→</span>
        </Link>
      </Screen>
    );
  }

  const total = friends.accepted.length + friends.incoming.length + friends.outgoing.length;

  return (
    <Screen maxWidth="compact">
      <header className="flex flex-col gap-2">
        <h1 className={TEXT.display}>Friends</h1>
        <p className={TEXT.body}>
          Add someone by their code, then challenge them to a game. Chess Mind has no player
          search and no messaging — you can only add someone whose code you already have.
        </p>
      </header>

      <PrimaryCard className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className={`${TEXT.meta} text-premium-gold`}>Your code</p>
          <p className="font-classic-display text-2xl tracking-[0.3em] text-premium-ivory">
            {myCode ?? "—"}
          </p>
          <p className={TEXT.caption}>
            Share this with people you know. Anyone with it can send you a request, which you
            still have to accept.
          </p>
        </div>
        <div className="border-t border-white/10 pt-4">
          <AddFriendBox childId={child.id} />
        </div>
      </PrimaryCard>

      {friends.incoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader title={`Requests (${friends.incoming.length})`} />
          <ul className="flex flex-col gap-2">
            {friends.incoming.map((r) => (
              <FriendRowItem key={r.friendshipId} row={r} childId={child.id} kind="incoming" />
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeader title={`Friends (${friends.accepted.length})`} />
        {friends.accepted.length === 0 ? (
          <EmptySection>
            {total === 0
              ? "No friends yet. Share your code above, or enter someone else's."
              : "No accepted friends yet — requests are still waiting."}
          </EmptySection>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.accepted.map((r) => (
              <FriendRowItem key={r.friendshipId} row={r} childId={child.id} kind="accepted" />
            ))}
          </ul>
        )}
      </section>

      {friends.outgoing.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader title="Sent" />
          <ul className="flex flex-col gap-2">
            {friends.outgoing.map((r) => (
              <FriendRowItem key={r.friendshipId} row={r} childId={child.id} kind="outgoing" />
            ))}
          </ul>
        </section>
      )}

      <p className={TEXT.caption}>
        Chess Mind does not include messaging between players. Friends can play each other and
        see each other&apos;s name and rating, and nothing else.
      </p>
    </Screen>
  );
}
