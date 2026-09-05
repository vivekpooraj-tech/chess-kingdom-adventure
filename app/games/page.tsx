import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { resolveActiveChild, getPlayedGames } from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { Screen } from "@/components/layout/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TEXT } from "@/lib/designSystem";
import { getTimeControl } from "@/content/timeControls";
import { EmptySection } from "@/components/stats/StatBlocks";

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
 * Server component, no client JavaScript.
 */

function resultLabel(result: "win" | "loss" | "draw"): { text: string; tone: string; glyph: string } {
  if (result === "win") return { text: "Win", tone: "text-premium-gold", glyph: "▲" };
  if (result === "loss") return { text: "Loss", tone: "text-premium-ivory/55", glyph: "▼" };
  return { text: "Draw", tone: "text-premium-ivory/75", glyph: "=" };
}

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
    <Screen maxWidth="compact">
      <header className="flex flex-col gap-2">
        <h1 className={TEXT.display}>Your Games</h1>
        <p className={TEXT.body}>
          Every finished game. Open one to review it and see where the game turned.
        </p>
      </header>

      {games.length === 0 ? (
        <EmptySection>
          No finished games yet. Play one and it will appear here with its review.
        </EmptySection>
      ) : (
        <section className="flex flex-col gap-3">
          <SectionHeader title={`${games.length} ${games.length === 1 ? "game" : "games"}`} />
          <ol className="flex flex-col gap-2">
            {games.map((g) => {
              const r = resultLabel(g.result);
              const tc = g.timeControl ? getTimeControl(g.timeControl).label : "Untimed";
              const delta =
                typeof g.ratingBefore === "number" && typeof g.ratingAfter === "number"
                  ? g.ratingAfter - g.ratingBefore
                  : null;

              return (
                <li key={g.id}>
                  <Link
                    href={`/online/${g.id}`}
                    className="flex min-h-[64px] items-center gap-3 rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-4 py-3 transition-colors hover:border-premium-gold/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
                  >
                    {/* Result is carried by a word and a glyph, not colour alone. */}
                    <span
                      className={`flex w-12 flex-none flex-col items-center font-classic-body text-xs ${r.tone}`}
                    >
                      <span aria-hidden="true" className="text-sm leading-none">
                        {r.glyph}
                      </span>
                      {r.text}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-classic-body text-sm text-premium-ivory">
                        {g.tournamentId
                          ? "Tournament game"
                          : g.matchType === "random"
                            ? "Online Opponent"
                            : "Friend Match"}
                      </span>
                      <span className={TEXT.caption}>
                        {g.color === "w" ? "White" : "Black"} · {tc} · {formatDate(g.playedAt)}
                      </span>
                    </span>
                    {delta !== null && (
                      <span
                        className={`flex-none font-classic-body text-sm ${
                          delta > 0 ? "text-premium-gold" : "text-premium-ivory/55"
                        }`}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </span>
                    )}
                    <span aria-hidden="true" className="flex-none text-premium-gold">
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className={TEXT.caption}>
            Rating changes are shown for rated games that recorded them.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <Link
          href="/stats"
          className="flex min-h-[52px] items-center justify-between rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-4 font-classic-body text-sm text-premium-ivory hover:border-premium-gold/30"
        >
          See what these games show <span aria-hidden="true">→</span>
        </Link>
        <Link
          href="/play"
          className="flex min-h-[52px] items-center justify-between rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-4 font-classic-body text-sm text-premium-ivory hover:border-premium-gold/30"
        >
          Play another game <span aria-hidden="true">→</span>
        </Link>
      </section>
    </Screen>
  );
}
