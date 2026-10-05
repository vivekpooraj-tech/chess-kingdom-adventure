"use client";

import { backLabel } from "@/lib/navigation/destinations";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Screen } from "@/components/layout/Screen";
import { ListItemRow } from "@/components/ui/Card";
import { CHESS_MIND_CATEGORIES, getChessMindCategory } from "@/content/chessMindCategories";
import { getDailyChallengeCategoryId } from "@/lib/chessMind/dailyChallenge";
import { getUnlockedKingdomBonuses, UnlockedBonus } from "@/lib/chessMind/kingdomUnlocks";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import {
  resolveActiveChild,
  getChessMindStatsByModule,
  getChessMindStreak,
  getTodayChessMindModules,
  getSkillSignals,
  getRecentGameReviews,
} from "@/lib/supabase/queries";
import { deriveLearnerProfile, type OllieLearnerProfile } from "@/lib/ollie/learnerContext";
import { buildChessBrainView, type ChessBrainView } from "@/lib/learner/chessBrain";
import { ChessBrainPanel } from "@/components/learner/ChessBrainPanel";
import { OllieNoticedCard } from "@/components/ollie/OllieNoticedCard";
import type { ExperienceLevel, AgeBand } from "@/lib/learner/experienceLevel";
import { getActiveChildIdClient } from "@/lib/childSession";
import { FlameIcon } from "@/components/nav/icons";
import { TEXT } from "@/lib/designSystem";
import { useMode } from "@/lib/mode/useMode";
import { worldFromMode } from "@/lib/world/worlds";
import { WORLD_VOICE } from "@/lib/trainYourMind/worldVoice";
import { loadAllProgress } from "@/lib/trainYourMind/progressClient";
import { getTrainYourMindUsageAll, type UsageSnapshot } from "@/lib/trainYourMind/dailyUsage";
import type { TrainModule } from "@/lib/trainYourMind/dailyLimitRules";
import { levelProgress, statusLabel, type ProgressState } from "@/lib/trainYourMind/progression";
import { isTrainCategory } from "@/lib/trainYourMind/curriculum";

export default function ChessMindPage() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [streak, setStreak] = useState(0);
  const [todayModules, setTodayModules] = useState<string[]>([]);
  const [bonuses, setBonuses] = useState<UnlockedBonus[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [childId, setChildId] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
  const [profile, setProfile] = useState<OllieLearnerProfile>({});
  const [brain, setBrain] = useState<ChessBrainView | null>(null);
  const [progress, setProgress] = useState<Record<string, ProgressState>>({});
  // Today's free usage PER CATEGORY (3 completed exercises per child per day in each of the eight
  // categories) — the server's counts, never local ones.
  const [usage, setUsage] = useState<Partial<Record<TrainModule, UsageSnapshot>> | null>(null);
  const { mode } = useMode();
  const voice = WORLD_VOICE[worldFromMode(mode)];

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const user = await getVerifiedUser(supabase);
      if (!user) {
        setLoaded(true);
        return;
      }
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (!resolution.child) {
        setLoaded(true);
        return;
      }
      const childId = resolution.child.id;
      // The two signal reads join the existing batch rather than adding a new
      // sequential layer, so Ollie's awareness costs no extra round-trip.
      const [statsResult, streakResult, todayResult, signals, reviews, progressResult, usageResult] = await Promise.all([
        getChessMindStatsByModule(supabase, childId).catch(() => ({})),
        getChessMindStreak(supabase, childId).catch(() => 0),
        getTodayChessMindModules(supabase, childId).catch(() => []),
        getSkillSignals(supabase, childId).catch(() => ({})),
        getRecentGameReviews(supabase, childId).catch(() => []),
        loadAllProgress(supabase, childId),
        getTrainYourMindUsageAll(supabase, childId),
      ]);
      setProgress(progressResult);
      setUsage(usageResult);
      setStats(statsResult);
      setStreak(streakResult);
      setTodayModules(todayResult);
      setBonuses(getUnlockedKingdomBonuses(statsResult));
      setChildId(childId);
      setExperienceLevel(resolution.child.experience_level ?? null);
      setAgeBand(resolution.child.age_band ?? null);
      const derived = deriveLearnerProfile(signals, reviews);
      setProfile(derived);
      setBrain(buildChessBrainView(signals, reviews, derived));
      setLoaded(true);
    }
    load();
  }, []);

  const dailyCategoryId = getDailyChallengeCategoryId();
  const dailyCategory = getChessMindCategory(dailyCategoryId);
  const dailyDoneToday = todayModules.includes(dailyCategoryId);

  const playable = CHESS_MIND_CATEGORIES.filter((c) => c.href);
  // "Continue Training" nudges toward whichever playable category has the
  // least practice behind it — real signal from real solve counts, not a
  // guess, and it naturally rotates once every category has some history.
  const continueCategory = [...playable].sort(
    (a, b) => (stats[a.id] ?? 0) - (stats[b.id] ?? 0)
  )[0];

  return (
    <>
      <Screen maxWidth="medium" topSafeArea="icons">
        <div className="mx-auto max-w-xl text-center">
          <h1 className={TEXT.display}>{voice.title}</h1>
          <p className={`${TEXT.body} mt-2`}>{voice.subtitle}</p>
          <p className={`${TEXT.caption} normal-case mt-2`}>{voice.caption}</p>
        </div>

        {loaded && usage && !Object.values(usage).some((u) => u?.isPremium) && (
          <p className={`${TEXT.caption} normal-case text-center`} role="status">
            Free training: 3 exercises per category, every day.
          </p>
        )}

        {loaded && streak > 0 && (
          <div className="flex items-center gap-2 rounded-full bg-premium-navy border border-premium-gold/30 px-4 py-1.5">
            <FlameIcon className="w-4 h-4 text-premium-gold" />
            <span className="font-classic-body text-sm text-premium-ivory">
              {streak}-day streak
            </span>
          </div>
        )}

        {/* Renders only once a genuine recurring weakness exists — see
            OllieNoticedCard / deriveLearnerProfile. New learners see nothing. */}
        {loaded && (
          <OllieNoticedCard
            profile={profile}
            childId={childId}
            experienceLevel={experienceLevel}
            ageBand={ageBand}
          />
        )}

        {loaded && brain && <ChessBrainPanel view={brain} />}

        {dailyCategory?.href && (
          <Link
            href={dailyCategory.href}
            className="list-row w-full rounded-premiumCard bg-gradient-to-br from-premium-gold/20 to-premium-navy border border-premium-gold/40 shadow-premiumCard p-5 flex items-center gap-4"
          >
            <span className="text-4xl">{dailyCategory.emoji}</span>
            <div className="flex-1">
              <p className={`${TEXT.meta} text-premium-gold`}>
                Today&apos;s Challenge {dailyDoneToday ? "· Done ✓" : ""}
              </p>
              <p className="font-classic-display text-lg text-premium-ivory">{dailyCategory.title}</p>
            </div>
            <span className="font-classic-display text-sm font-semibold text-premium-midnightDeep bg-premium-gold rounded-full px-4 py-2 flex-none">
              Start
            </span>
          </Link>
        )}

        {continueCategory?.href && (
          <Link
            href={continueCategory.href}
            className="list-row w-full rounded-premiumCard bg-premium-navy shadow-premiumCard p-4 flex items-center gap-4"
          >
            <span className="text-2xl">{continueCategory.emoji}</span>
            <div className="flex-1">
              <p className="font-classic-body text-[11px] font-semibold text-premium-ivory/50 uppercase tracking-wide">
                Continue Training
              </p>
              <p className="font-classic-display text-base text-premium-ivory">
                {continueCategory.title}
              </p>
            </div>
            <span className="text-premium-ivory/40 text-lg">→</span>
          </Link>
        )}

        {bonuses.length > 0 && (
          <div className="w-full rounded-premiumCard bg-premium-gold/10 border border-premium-gold/30 p-4 flex flex-col gap-2">
            <p className="font-classic-body text-xs font-semibold text-premium-gold uppercase tracking-wide">
              Kingdom Bonuses Unlocked
            </p>
            {bonuses.map((b) => (
              <Link
                key={b.zoneId}
                href="/home"
                className="font-classic-body text-sm text-premium-ivory/80 underline underline-offset-2"
              >
                {b.label} →
              </Link>
            ))}
          </div>
        )}

        {/* A flat list of rows, not a stack of up to 10 individually-
            shadowed cards — ListItemRow (design system, components/ui/
            Card.tsx) keeps the same content but reads as one list, not a
            wall of identical boxes. The three feature cards above (Daily
            Challenge, Continue Training, Kingdom Bonuses) stay full cards —
            they're genuinely different, higher-priority content, not list
            entries. */}
        <div className="flex w-full flex-col gap-1.5">
          {CHESS_MIND_CATEGORIES.map((cat) => {
            const score = stats[cat.id] ?? 0;
            if (!cat.href) {
              return (
                <ListItemRow key={cat.id} className="opacity-50">
                  <span className="text-2xl">{cat.emoji}</span>
                  <div className="flex-1">
                    <p className="font-classic-display text-base text-premium-ivory">{cat.title}</p>
                    <p className="font-classic-body text-xs text-premium-ivory/50">{cat.description}</p>
                  </div>
                  <span className="font-classic-body text-[11px] font-semibold text-premium-gold/70 border border-premium-gold/30 rounded-full px-2 py-1 whitespace-nowrap">
                    SOON
                  </span>
                </ListItemRow>
              );
            }
            return (
              <ListItemRow key={cat.id} href={cat.href}>
                <span className="text-2xl">{cat.emoji}</span>
                <div className="flex-1">
                  <p className="font-classic-display text-base text-premium-ivory">{cat.title}</p>
                  <p className="font-classic-body text-xs text-premium-ivory/50">{cat.description}</p>
                  <UsageLine usage={usage?.[cat.id as TrainModule] ?? null} />
                  {isTrainCategory(cat.id) && (
                    <TrainStatus state={progress[cat.id] ?? null} category={cat.id} fallbackScore={score} />
                  )}
                </div>
                <span className="text-premium-gold text-lg">→</span>
              </ListItemRow>
            );
          })}
        </div>

        <Link
          href="/learn"
          className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/65 underline underline-offset-2"
        >
          {backLabel("LEARN")}
        </Link>
      </Screen>
    </>
  );
}

/** Level + progress for one training path: a name and five small steps, no dashboards. */
function TrainStatus({
  state,
  category,
  fallbackScore,
}: {
  state: ProgressState | null;
  category: Parameters<typeof statusLabel>[1];
  fallbackScore: number;
}) {
  const label = statusLabel(state, category);
  if (!state || state.attempts === 0) {
    return (
      <p className="font-classic-body text-[11px] text-premium-ivory/40 mt-1">
        {fallbackScore > 0 ? "Pick up where you left off — now with levels" : "Not started · begins at Foundation"}
      </p>
    );
  }
  const p = levelProgress(state);
  return (
    <div className="mt-1 flex items-center gap-2">
      <p className="font-classic-body text-[11px] text-premium-gold/90">
        {label}
        {state.mastered ? " ★" : ""}
      </p>
      {!state.mastered && (
        <span className="flex gap-0.5" aria-label={`${p.have} of ${p.need} to the next level`}>
          {Array.from({ length: p.need }, (_, i) => (
            <span key={i} className={`h-1 w-3 rounded-full ${i < p.have ? "bg-premium-gold" : "bg-premium-ivory/15"}`} />
          ))}
        </span>
      )}
    </div>
  );
}

/** "n / 3 today" for one category (free accounts only) — the server's count. */
function UsageLine({ usage }: { usage: UsageSnapshot | null }) {
  if (!usage || usage.isPremium || usage.limit === null) return null;
  const done = usage.usedToday >= usage.limit;
  return (
    <p className={`font-classic-body text-[11px] mt-1 ${done ? "text-premium-gold/90" : "text-premium-ivory/45"}`}>
      {Math.min(usage.usedToday, usage.limit)} / {usage.limit} today{done ? " · done for today" : ""}
    </p>
  );
}
