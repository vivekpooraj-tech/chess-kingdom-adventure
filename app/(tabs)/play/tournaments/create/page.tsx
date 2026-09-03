"use client";

import { Screen } from "@/components/layout/Screen";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { createTournament, TournamentCategory } from "@/lib/supabase/tournamentQueries";
import { getTimeControlsByCategory } from "@/content/timeControls";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";

const PLAYER_LIMIT_OPTIONS = [8, 16, 20, 32, 50, 100];

/** Suggested defaults per the spec — the creator can always override. */
function suggestedRounds(maxPlayers: number): number {
  if (maxPlayers <= 8) return 4;
  if (maxPlayers <= 16) return 5;
  if (maxPlayers <= 20) return 6;
  return 7;
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center min-h-[44px] rounded-premiumBtn px-3.5 py-2 text-sm font-classic-body border transition-colors ${
        active
          ? "bg-premium-gold text-premium-midnightDeep border-premium-gold font-semibold"
          : "bg-premium-navy/70 text-premium-ivory/80 border-white/15 hover:border-premium-gold/40"
      }`}
    >
      {children}
    </button>
  );
}

export default function CreateTournamentPage() {
  const router = useRouter();
  const [childId, setChildId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TournamentCategory>("Blitz");
  const [timeControlId, setTimeControlId] = useState("5+0");
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [rounds, setRounds] = useState(6);
  const [roundsTouched, setRoundsTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const user = await getVerifiedUser(supabase);
      if (!user) {
        router.push("/sign-in");
        return;
      }
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (resolution.needsSelection) {
        router.push("/choose-child");
        return;
      }
      setChildId(resolution.child!.id);
    }
    load();
  }, [router]);

  function handleCategoryChange(next: TournamentCategory) {
    setCategory(next);
    setTimeControlId(getTimeControlsByCategory(next)[0].id);
  }

  function handleMaxPlayersChange(n: number) {
    setMaxPlayers(n);
    if (!roundsTouched) setRounds(suggestedRounds(n));
  }

  async function handleCreate() {
    if (!childId || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const id = await createTournament(supabase, {
        creatorChildId: childId,
        name: name.trim(),
        category,
        timeControlId,
        maxPlayers,
        roundsTotal: rounds,
      });
      router.push(`/play/tournaments/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the tournament.");
      setLoading(false);
    }
  }

  const availableTimeControls = getTimeControlsByCategory(category);

  return (
    <>
      <Screen maxWidth="compact">
        <div className="mx-auto max-w-xl text-center">
          <h1 className={TEXT.display}>Create Tournament</h1>
          <p className={`${TEXT.body} mt-2`}>Set it up, then invite players to join before you start it.</p>
        </div>

        <div className="w-full flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className={`${TEXT.caption} uppercase tracking-wide`}>Tournament Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Chess Mind Blitz Arena"
              maxLength={60}
              className="rounded-premiumBtn px-3.5 py-2.5 text-base border border-white/15 bg-premium-midnightDeep text-premium-ivory font-classic-body"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={`${TEXT.caption} uppercase tracking-wide`}>Format</span>
            <div className="flex gap-2">
              {(["Blitz", "Rapid"] as const).map((cat) => (
                <ChoiceButton key={cat} active={category === cat} onClick={() => handleCategoryChange(cat)}>
                  {cat}
                </ChoiceButton>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={`${TEXT.caption} uppercase tracking-wide`}>Time Control</span>
            <div className="flex flex-wrap gap-2">
              {availableTimeControls.map((tc) => (
                <ChoiceButton key={tc.id} active={timeControlId === tc.id} onClick={() => setTimeControlId(tc.id)}>
                  {tc.label}
                </ChoiceButton>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={`${TEXT.caption} uppercase tracking-wide`}>Max Players</span>
            <div className="flex flex-wrap gap-2">
              {PLAYER_LIMIT_OPTIONS.map((n) => (
                <ChoiceButton key={n} active={maxPlayers === n} onClick={() => handleMaxPlayersChange(n)}>
                  {n}
                </ChoiceButton>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={`${TEXT.caption} uppercase tracking-wide`}>Rounds</span>
            <input
              type="number"
              min={1}
              max={20}
              value={rounds}
              onChange={(e) => {
                setRoundsTouched(true);
                setRounds(Math.max(1, Math.min(20, Number(e.target.value) || 1)));
              }}
              className="w-24 rounded-premiumBtn px-3.5 py-2.5 text-base border border-white/15 bg-premium-midnightDeep text-premium-ivory font-classic-body"
            />
            <span className={`${TEXT.caption} normal-case`}>
              Suggested for {maxPlayers} players: {suggestedRounds(maxPlayers)} — you can change this.
            </span>
          </label>

          {error && <p className="font-classic-body text-sm text-red-300">{error}</p>}

          <Button tone="premium" onClick={handleCreate} disabled={!childId || !name.trim() || loading}>
            {loading ? "Creating..." : "Create Tournament"}
          </Button>
        </div>
      </Screen>
    </>
  );
}
