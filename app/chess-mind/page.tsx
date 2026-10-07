"use client";

import { useEffect, useState } from "react";
import { Screen } from "@/components/layout/Screen";
import { WorldScope } from "@/components/layout/WorldScope";
import { TrainBody } from "@/components/trainYourMind/TrainBody";
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
import { useMode } from "@/lib/mode/useMode";
import { worldFromMode } from "@/lib/world/worlds";
import { WORLD_VOICE } from "@/lib/trainYourMind/worldVoice";
import { loadAllProgress } from "@/lib/trainYourMind/progressClient";
import { getTrainYourMindUsageAll, type UsageSnapshot } from "@/lib/trainYourMind/dailyUsage";
import type { TrainModule } from "@/lib/trainYourMind/dailyLimitRules";
import type { ProgressState } from "@/lib/trainYourMind/progression";

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
    <WorldScope>
      <Screen maxWidth="wide" topSafeArea="icons">
        {/* All data and logic stay here; TrainBody only lays the same real values out per world (Enchanted quests, Atelier session,
            Classic study desk). */}
        <TrainBody
          voice={voice}
          loaded={loaded}
          categories={CHESS_MIND_CATEGORIES}
          stats={stats}
          progress={progress}
          usage={usage}
          streak={streak}
          dailyCategory={dailyCategory}
          dailyDoneToday={dailyDoneToday}
          continueCategory={continueCategory}
          bonuses={bonuses}
          extras={
            <>
              {/* Renders only once a genuine recurring weakness exists — see OllieNoticedCard / deriveLearnerProfile.
                  New learners see nothing. */}
              {loaded && (
                <OllieNoticedCard
                  profile={profile}
                  childId={childId}
                  experienceLevel={experienceLevel}
                  ageBand={ageBand}
                />
              )}
              {loaded && brain && <ChessBrainPanel view={brain} />}
            </>
          }
        />
      </Screen>
    </WorldScope>
  );
}
