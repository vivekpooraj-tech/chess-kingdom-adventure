import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { resolveActiveChild, getPlayedGames } from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { Screen } from "@/components/layout/Screen";
import { GameRow } from "@/components/games/GameRow";
import { EmptySection } from "@/components/stats/StatBlocks";
import { TEXT } from "@/lib/designSystem";

export const metadata = {
  title: "Your Games · Chess Mind",
  description: "Every game you have finished, and the review for each one.",
};

/**
 * Game history — the missing step in the improvement loop.
 *
 * Play, Game Review and practice all existed, but nothing listed a player's
 * finished games, so a review was only reachable in the moments right after a
 * game ended. Once that screen was gone the game was gone. This makes every
 * finished game reachable, which is what turns "play → review → practise" from
 * a description into something a player can actually walk.
 *
 * Opponents are labelled, never named. The app already shows "Online Opponent"
 * rather than an identity for random matches (app/online/[gameId]/page.tsx), a
 * deliberate child-safety choice for a product with children on it, and a
 * history page listing who a child played would quietly undo that.
 *
 * Server component, no client JavaScript. Mode-aware (Phase 2.2-L): the
 * 100-game list is fetched and rendered exactly ONCE — only the header and
 * empty-state copy (small, single-instance elements) are tripled into
 * `games-mode-panel-*` blocks, shown one at a time via the same pre-hydration
 * `[data-mode]` CSS switch Home and Play use (see app/modes.css's
 * "GAMES MODE PRESENTATION" block and components/games/GameRow.tsx for how
 * the per-row wording differences are handled without duplicating rows).
 */

export default async function GamesPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");
  const child = resolution.child;
  if (!child) redirect("/choose-child");

  const games = await getPlayedGames(supabase, child.id, 100);

  return (
    <Screen maxWidth="compact" contentClassName="games-mode-scope">
      <header className="games-mode-panel games-mode-panel-classic-pro flex flex-col gap-2">
        <h1 className={TEXT.display}>Match History</h1>
        <p className={TEXT.body}>Every finished game, newest first.</p>
      </header>
      <header className="games-mode-panel games-mode-panel-adult flex flex-col gap-2">
        <h1 className={TEXT.display}>Game Log &amp; Review</h1>
        <p className={TEXT.body}>Every finished game is material for review — open one to study it.</p>
      </header>
      <header className="games-mode-panel games-mode-panel-kids flex flex-col gap-2">
        <h1 className={TEXT.display}>Your Games</h1>
        <p className={TEXT.body}>Look back at every game you&apos;ve played!</p>
      </header>

      {games.length === 0 ? (
        <>
          <div className="games-mode-panel games-mode-panel-classic-pro">
            <EmptySection>No finished games yet. Play one and it will appear here.</EmptySection>
          </div>
          <div className="games-mode-panel games-mode-panel-adult">
            <EmptySection>No finished games yet. Play one and it will become your first review.</EmptySection>
          </div>
          <div className="games-mode-panel games-mode-panel-kids">
            <EmptySection>Play a game and it&apos;ll show up here!</EmptySection>
          </div>
        </>
      ) : (
        <section className="flex flex-col gap-3">
          <ol className="flex flex-col gap-2 games-list">
            {games.map((g) => (
              <GameRow key={g.id} game={g} />
            ))}
          </ol>
        </section>
      )}

      <section className="flex flex-col gap-2 games-footer">
        <Link
          href="/stats"
          className="games-footer-link flex min-h-[52px] items-center justify-between rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-4 font-classic-body text-sm text-premium-ivory hover:border-premium-gold/30"
        >
          See what these games show <span aria-hidden="true">→</span>
        </Link>
        <Link
          href="/play"
          className="games-footer-link flex min-h-[52px] items-center justify-between rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-4 font-classic-body text-sm text-premium-ivory hover:border-premium-gold/30"
        >
          Play another game <span aria-hidden="true">→</span>
        </Link>
      </section>
    </Screen>
  );
}
