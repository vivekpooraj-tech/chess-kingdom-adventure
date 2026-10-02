import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";
import { ALL_SKILL_IDS, type SkillId } from "@/lib/analysis/skills";
import { PARENT_PREMIUM_COLUMNS, resolvePremiumState } from "@/lib/premium/entitlement";
import { pickBiggestMoment } from "@/lib/analysis/skillMapping";
import { skillWeaknessCountsFromFacts } from "@/lib/analysis/gameReviewSignals";
import {
  getFreeGameReviewAnalysis,
  getPremiumGameReviewAnalysis,
  upsertGameReviewAnalysis,
  bumpSkillWeaknesses,
  type GameReviewAnalysisSnapshot,
  type GameReviewInput,
} from "@/lib/supabase/queries";

/**
 * Turns the engine's raw facts (which move, what category, what the engine
 * would have played instead) into the kid-friendly "why" prose the
 * post-game analysis screen shows — never exposes centipawn numbers or
 * engine-speak to the child (see section 16 of the brief this implements).
 * Same Claude call pattern as app/api/ai/coach/route.ts (raw fetch, same
 * model, same mock-fallback-when-no-key approach) — no new AI provider.
 *
 * Phase A addition: each mistake also carries a conservative `skillHint`
 * (computed by lib/analysis/skillMapping.ts from engine facts only). The
 * model MAY refine it to a more specific skill from the fixed taxonomy
 * when the facts clearly support it, but the server coerces whatever comes
 * back to a valid SkillId and falls back to the hint — so the client can
 * never receive an out-of-taxonomy or invented skill.
 *
 * Phase 7A: Premium is now enforced HERE, not just in the React render
 * layer. Free accounts previously received this exact same full response
 * and simply didn't render most of it — inspectable in full via the
 * Network tab. Now: entitlement is resolved server-side from the
 * authenticated session (resolvePremiumState() — never trusted from the
 * request body, which carries no tier field at all), and a Free response
 * is built from a TRIMMED request (only the single "biggest moment"
 * mistake, chosen via the same pickBiggestMoment() the client uses for its
 * own BiggestMomentCard — not a second ranking) with no goodMoves and no
 * insights ever requested from Claude or present in the response.
 *
 * Phase 7B: this route is now also the single place a completed review's
 * analysis is persisted/reused, so reloading an already-reviewed game
 * never calls Claude again and never double-writes child_game_reviews /
 * child_skill_signals. Flow, in order:
 *   1. authenticate, resolve Premium (unchanged from Phase 7A)
 *   2. if the request carries a gameRef, look up the PERSISTED snapshot for
 *      the RESOLVED tier ONLY (getFreeGameReviewAnalysis for Free,
 *      getPremiumGameReviewAnalysis for Premium — never the other) and, if
 *      present, return it directly with NO Claude call and NO writes
 *   3. otherwise generate exactly as Phase 7A did, then persist via the
 *      upsert_child_game_review_analysis RPC (lib/supabase/queries.ts's
 *      upsertGameReviewAnalysis) keyed on (childId, source, gameRef) — a
 *      Premium generation persists BOTH the full analysis and a Free-safe
 *      subset derived from it (via pickBiggestMoment on the SAME full
 *      response), so a later Premium->Free downgrade never needs a fresh
 *      Claude call either
 *   4. child_skill_signals is bumped ONLY when the RPC reports this was a
 *      brand-new row (isNewRow) — i.e. exactly once ever per reviewed
 *      game, never on a cache hit and never again when a later tier
 *      upgrade generates additional content for an already-reviewed game
 * A request with no gameRef (an old client build, or Free-Play generation
 * failing for some reason) falls back to Phase 7A's exact behavior:
 * generate every time, persist nothing — degraded, not broken.
 */
const SKILL_ID_LIST = ALL_SKILL_IDS.join(", ");

const ANALYSIS_SYSTEM_PROMPT = `You are the Chess Mind post-game coach for a child aged 5-12. You are
warm, encouraging, and never say a child is "wrong" or "bad" — you explain what happened and what to
notice next time, like a kind teacher. You are given a list of specific moves from a game they just
played, each with facts a chess engine already determined (their move, the category, and — for
mistakes — the better move available). Your job is ONLY to explain WHY in simple language a 7-12 year
old can follow, and state ONE reusable chess principle per mistake. Never invent facts not given to
you (don't claim a piece was hanging if you weren't told so, don't invent threats). If multiple good
moves existed, say "one strong option was..." rather than claiming the given move is the only correct
one.

Each mistake includes "skillHint" — a conservative guess at the skill it relates to. Keep that skill
UNLESS the facts you were given clearly point to a different one, in which case choose the best fit
from this exact list (use the id, lowercase, underscores): ${SKILL_ID_LIST}. Never use a skill id
that is not in that list. When unsure, keep the skillHint. Do not choose a specific tactical skill
(forks, pins, skewers, discovered_attacks) unless the facts explicitly describe that pattern —
otherwise use tactical_awareness or keep the hint.

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape:
{
  "mistakes": { "<ply>": { "explanation": "...", "whyBetter": "...", "whatToNotice": "...", "skill": "<skill_id>" } },
  "goodMoves": { "<ply>": { "explanation": "..." } },
  "biggestLesson": "...",
  "insights": ["...", "..."]
}
"explanation" for a mistake: 1-2 short sentences on what went wrong in THIS position. "whyBetter": 1
short sentence on what the better move you were given actually achieves (what it defends, wins, stops
or threatens) — omit it entirely if you were not given a better move, and never guess at a tactic you
were not told about. "whatToNotice":
one short, reusable principle ("Before attacking, check whether your king is safe."). "skill": one id
from the list above. "explanation" for a good move: 1 short encouraging sentence on what they saw.
"biggestLesson": one sentence summarizing the single most important thing from this specific game.
"insights": 1-2 short, specific lessons grounded in what actually happened in this game — never
generic chess advice unrelated to the moves given.`;

/**
 * Free-tier prompt (Phase 7A). Deliberately asks for LESS than the full
 * prompt above — one mistake, no good moves, no insights — both to keep
 * Premium's deeper analysis from ever being requested for a Free account
 * and to cut the Claude request/response size for the common case (most
 * games are reviewed by Free accounts).
 */
const FREE_ANALYSIS_SYSTEM_PROMPT = `You are the Chess Mind post-game coach for a child aged 5-12. You are
warm, encouraging, and never say a child is "wrong" or "bad" — you explain what happened and what to
notice next time, like a kind teacher. You are given ONE specific mistake from a game they just played,
with facts a chess engine already determined (their move, the category, and — if one exists — the
better move available). Your job is ONLY to explain WHY in simple language a 7-12 year old can follow,
state ONE reusable chess principle for it, and give ONE sentence summarizing the single most important
thing from this game. Never invent facts not given to you.

The mistake includes "skillHint" — a conservative guess at the skill it relates to. Keep that skill
UNLESS the facts you were given clearly point to a different one, in which case choose the best fit
from this exact list (use the id, lowercase, underscores): ${SKILL_ID_LIST}. Never use a skill id that
is not in that list. When unsure, keep the skillHint.

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape:
{
  "mistakes": { "<ply>": { "explanation": "...", "whyBetter": "...", "whatToNotice": "...", "skill": "<skill_id>" } },
  "biggestLesson": "..."
}
"explanation": 1-2 short sentences on what went wrong in THIS position. "whyBetter": 1 short sentence on
what the better move actually achieves — omit it entirely if no better move was given, and never guess
at a tactic you were not told about. "whatToNotice": one short, reusable principle. "skill": one id from
the list above. "biggestLesson": one sentence summarizing the single most important thing from this
specific game. Do not include "goodMoves" or "insights" — they are not requested.`;

interface MistakeInput {
  ply: number;
  moveNumber: number;
  san: string;
  category: "mistake" | "blunder";
  bestMoveSan?: string;
  isCapture?: boolean;
  missedMate?: boolean;
  missedMaterial?: boolean;
  /** Phase 7A: lets the server pick the same "biggest moment" the client's
   * own BiggestMomentCard uses, via the real pickBiggestMoment() — never a
   * second ranking. Optional/defaulted to 0 for defensiveness against an
   * older client build, though the current client always sends it. */
  lossCp?: number;
  /** Conservative skill guess from lib/analysis/skillMapping.ts. */
  skillHint?: string;
  skillConfidence?: "high" | "medium" | "low";
}

interface GoodMoveInput {
  ply: number;
  moveNumber: number;
  san: string;
}

/** Phase 7B: the same fields buildGameReviewInput() (lib/analysis/
 * gameReviewSignals.ts) already computed purely client-side for the old
 * recordGameReview() call — now sent to the server instead, since
 * persistence moved here. biggestMomentSkill/biggestMomentPly are NOT
 * included: the route computes those itself from `mistakes` + whatever
 * explanation it ends up using, exactly mirroring the old client-side
 * logic. */
interface ReviewSummaryInput {
  playedColor: "w" | "b" | null;
  result: "win" | "loss" | "draw" | null;
  accuracy: number | null;
  totalMoves: number | null;
  mistakes: number;
  blunders: number;
  inaccuracies: number;
  openingName: string | null;
}

interface ExplainRequestBody {
  mistakes: MistakeInput[];
  goodMoves: GoodMoveInput[];
  context: {
    playerColor: "w" | "b";
    result: "win" | "loss" | "draw";
    openingName?: string | null;
    totalMoves: number;
  };
  /** Phase 7B — all optional so an older client build (no gameRef/childId/
   * source/summary yet) degrades to "generate every time, persist
   * nothing" rather than a 400. */
  childId?: string;
  source?: "free_play" | "online";
  gameRef?: string;
  summary?: ReviewSummaryInput;
}

const FALLBACK_EXPLANATION = "Your move gave up a significant advantage here.";
const FALLBACK_NOTICE = "Before you move, check what your opponent could do in response.";

function coerceSkill(value: unknown, hint: string | undefined): SkillId {
  if (typeof value === "string" && (ALL_SKILL_IDS as string[]).includes(value)) {
    return value as SkillId;
  }
  if (typeof hint === "string" && (ALL_SKILL_IDS as string[]).includes(hint)) {
    return hint as SkillId;
  }
  return "advantage_loss";
}

function mockResponse(body: ExplainRequestBody) {
  const mistakes: Record<
    number,
    { explanation: string; whyBetter?: string; whatToNotice: string; skill: SkillId }
  > = {};
  for (const m of body.mistakes) {
    mistakes[m.ply] = {
      explanation:
        m.missedMate === true
          ? "There was a forced checkmate available here that slipped by."
          : m.missedMaterial === true
            ? "There was a chance to win material here that wasn't taken."
            : `${m.san} gave your opponent a real chance to gain the upper hand here.`,
      whatToNotice: FALLBACK_NOTICE,
      skill: coerceSkill(undefined, m.skillHint),
    };
  }
  const goodMoves: Record<number, { explanation: string }> = {};
  for (const g of body.goodMoves) {
    goodMoves[g.ply] = { explanation: `${g.san} was a strong choice in this position!` };
  }
  return {
    mistakes,
    goodMoves,
    biggestLesson: "Keep checking your opponent's threats before you decide on your own move.",
    insights: ["Look for checks, captures, and threats before every move — yours and theirs."],
  };
}

/**
 * Normalises whatever Claude returned into the response contract, coercing
 * every mistake's skill to a valid SkillId and every text field to a safe
 * fallback — so a malformed / partial model response can never surface an
 * invented fact or an out-of-taxonomy skill to the child.
 */
function normalizeParsed(parsed: unknown, body: ExplainRequestBody) {
  const p = (parsed ?? {}) as Record<string, unknown>;
  const rawMistakes = (p.mistakes ?? {}) as Record<string, Record<string, unknown>>;
  const rawGood = (p.goodMoves ?? {}) as Record<string, Record<string, unknown>>;

  const mistakes: Record<
    number,
    { explanation: string; whyBetter?: string; whatToNotice: string; skill: SkillId }
  > = {};
  for (const m of body.mistakes) {
    const r = rawMistakes[String(m.ply)] ?? {};
    // whyBetter stays OPTIONAL rather than getting a generic fallback: there is
    // no honest default for "what this specific move achieves", and the UI
    // simply omits the line when it is missing.
    const whyBetter =
      m.bestMoveSan && typeof r.whyBetter === "string" && r.whyBetter.trim() ? r.whyBetter.trim() : undefined;
    mistakes[m.ply] = {
      explanation: typeof r.explanation === "string" && r.explanation.trim() ? r.explanation.trim() : FALLBACK_EXPLANATION,
      ...(whyBetter ? { whyBetter } : {}),
      whatToNotice: typeof r.whatToNotice === "string" && r.whatToNotice.trim() ? r.whatToNotice.trim() : FALLBACK_NOTICE,
      skill: coerceSkill(r.skill, m.skillHint),
    };
  }

  const goodMoves: Record<number, { explanation: string }> = {};
  for (const g of body.goodMoves) {
    const r = rawGood[String(g.ply)] ?? {};
    goodMoves[g.ply] = {
      explanation: typeof r.explanation === "string" && r.explanation.trim() ? r.explanation.trim() : "Nicely played!",
    };
  }

  const biggestLesson =
    typeof p.biggestLesson === "string" && p.biggestLesson.trim()
      ? p.biggestLesson.trim()
      : "Keep checking your opponent's threats before you decide on your own move.";
  const insights =
    Array.isArray(p.insights) && p.insights.every((x) => typeof x === "string")
      ? (p.insights as string[]).slice(0, 3)
      : [];

  return { mistakes, goodMoves, biggestLesson, insights };
}

/** Free never returns goodMoves or insights — enforced here regardless of
 * what mockResponse()/normalizeParsed() produced, so a model ignoring the
 * trimmed Free prompt can never leak them either. */
function freeSafe<T extends { goodMoves: Record<number, { explanation: string }>; insights: string[] }>(
  result: T,
  isPremium: boolean
): T {
  return isPremium ? result : { ...result, goodMoves: {}, insights: [] };
}

type ExplainResult = ReturnType<typeof normalizeParsed>;

/** Calls Claude (or falls back to mockResponse) for `effectiveBody` at the
 * given tier's prompt/token budget. Returns the RAW result — NOT yet run
 * through freeSafe() — because Phase 7B needs the pre-freeSafe shape twice:
 * once (freeSafe'd) for the HTTP response, and, for a Premium generation,
 * once again (via pickBiggestMoment on the ORIGINAL untrimmed mistakes) to
 * derive the Free-safe snapshot to persist alongside it. Exactly the same
 * Claude-call/parse/fallback behavior Phase 7A had — only extracted into
 * its own function so POST can call it from one place.
 */
async function generate(effectiveBody: ExplainRequestBody, isPremium: boolean): Promise<ExplainResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || (effectiveBody.mistakes.length === 0 && effectiveBody.goodMoves.length === 0)) {
    return mockResponse(effectiveBody);
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        // Free's prompt only ever asks about one mistake and never asks for
        // insights — a smaller cap keeps the response honest to that scope
        // and cuts token cost for what is the common case (most reviewed
        // games are Free accounts).
        max_tokens: isPremium ? 1500 : 500,
        system: isPremium ? ANALYSIS_SYSTEM_PROMPT : FREE_ANALYSIS_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: isPremium
              ? `${BRAND.name} game analysis. Context: ${JSON.stringify(effectiveBody.context)}\n\nMistakes: ${JSON.stringify(
                  effectiveBody.mistakes
                )}\n\nGood moves: ${JSON.stringify(effectiveBody.goodMoves)}`
              : `${BRAND.name} game analysis. Context: ${JSON.stringify(effectiveBody.context)}\n\nMistake: ${JSON.stringify(
                  effectiveBody.mistakes
                )}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text = data?.content?.find((c: { type: string }) => c.type === "text")?.text;
    if (!text) return mockResponse(effectiveBody);

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return mockResponse(effectiveBody);
    }
    return normalizeParsed(parsed, effectiveBody);
  } catch (err) {
    console.error("Game analysis explanation call failed:", err);
    return mockResponse(effectiveBody);
  }
}

/** The Free-safe subset of a FULL (Premium) result: the single biggest-
 * moment mistake explanation + biggestLesson, no goodMoves/insights —
 * chosen via the exact same pickBiggestMoment() the Free generation path
 * itself uses, over the ORIGINAL untrimmed mistake list, never a second
 * ranking. Used only to derive what to ALSO persist as free_analysis when
 * a Premium generation just happened, so a later Premium->Free downgrade
 * never needs a fresh Claude call. */
function deriveFreeSnapshot(fullResult: ExplainResult, allMistakes: MistakeInput[]): GameReviewAnalysisSnapshot {
  const biggest = pickBiggestMoment(
    allMistakes.map((m) => ({
      ...m,
      missedMate: m.missedMate ?? false,
      missedMaterial: m.missedMaterial ?? false,
      lossCp: m.lossCp ?? 0,
    }))
  );
  if (!biggest) {
    return { mistakes: {}, goodMoves: {}, biggestLesson: fullResult.biggestLesson, insights: [] };
  }
  const explained = fullResult.mistakes[biggest.ply] ?? {
    explanation: FALLBACK_EXPLANATION,
    whatToNotice: FALLBACK_NOTICE,
    skill: coerceSkill(undefined, biggest.skillHint),
  };
  return { mistakes: { [biggest.ply]: explained }, goodMoves: {}, biggestLesson: fullResult.biggestLesson, insights: [] };
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  // Phase 8B-hardening: getSessionUser() (middleware's x-user-id fast path,
  // plus one retry on a retryable Supabase fetch error) instead of a raw
  // supabase.auth.getUser() call — see app/api/stripe/checkout/route.ts's
  // identical comment. 401-on-unauthenticated behavior is unchanged; this
  // route's Premium gating (resolvePremiumState(), below) is untouched.
  const user = await getSessionUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ExplainRequestBody | null;
  if (!body || !Array.isArray(body.mistakes) || !Array.isArray(body.goodMoves)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Phase 7A: entitlement resolved server-side, from the authenticated
  // session only. The request body carries no tier field, and none ever
  // should — this is the same canonical source used everywhere else
  // (lib/premium/entitlement.ts's resolvePremiumState()), never re-derived.
  const { data: parent } = await supabase
    .from("parents")
    .select(PARENT_PREMIUM_COLUMNS)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const isPremium = resolvePremiumState(parent).isPremium;

  // Phase 7B: read-before-Claude. gameRef/childId/source are only trusted
  // as a CACHE KEY, never for entitlement — isPremium above is the only
  // thing that decides which column gets read or written below.
  const gameRef = typeof body.gameRef === "string" && body.gameRef.trim() ? body.gameRef.trim() : null;
  const childId = typeof body.childId === "string" && body.childId.trim() ? body.childId.trim() : null;
  const source = body.source === "free_play" || body.source === "online" ? body.source : null;
  const canCache = !!(gameRef && childId && source);

  if (canCache) {
    if (isPremium) {
      const persisted = await getPremiumGameReviewAnalysis(supabase, childId!, source!, gameRef!);
      if (persisted?.premiumAnalysis) {
        // Cache hit: NO Claude call, NO write, NO skill bump.
        return NextResponse.json(persisted.premiumAnalysis);
      }
    } else {
      const persisted = await getFreeGameReviewAnalysis(supabase, childId!, source!, gameRef!);
      if (persisted?.freeAnalysis) {
        // Cache hit: NO Claude call, NO write, NO skill bump.
        return NextResponse.json(persisted.freeAnalysis);
      }
    }
  }

  // Free: trim to the ONE mistake worth explaining, chosen via the same
  // pickBiggestMoment() the client's own BiggestMomentCard already uses —
  // not a second ranking — before anything is sent to Claude or returned.
  // Premium keeps the full submitted set, unchanged.
  const effectiveBody: ExplainRequestBody = isPremium
    ? body
    : {
        ...body,
        mistakes: (() => {
          const biggest = pickBiggestMoment(
            body.mistakes.map((m) => ({
              ...m,
              missedMate: m.missedMate ?? false,
              missedMaterial: m.missedMaterial ?? false,
              lossCp: m.lossCp ?? 0,
            }))
          );
          return biggest ? [biggest] : [];
        })(),
        goodMoves: [],
      };

  const rawResult = await generate(effectiveBody, isPremium);
  const clientResult = freeSafe(rawResult, isPremium);

  if (canCache) {
    const freeAnalysis = isPremium ? deriveFreeSnapshot(rawResult, body.mistakes) : clientResult;
    const premiumAnalysis = isPremium ? clientResult : null;

    const biggest = pickBiggestMoment(
      body.mistakes.map((m) => ({
        ...m,
        missedMate: m.missedMate ?? false,
        missedMaterial: m.missedMaterial ?? false,
        lossCp: m.lossCp ?? 0,
      }))
    );
    const biggestMomentPly = biggest?.ply ?? null;
    const biggestMomentSkill = biggest ? rawResult.mistakes[biggest.ply]?.skill ?? biggest.skillHint ?? null : null;

    const summary: GameReviewInput = {
      source: source!,
      playedColor: body.summary?.playedColor ?? null,
      result: body.summary?.result ?? null,
      accuracy: body.summary?.accuracy ?? null,
      totalMoves: body.summary?.totalMoves ?? null,
      mistakes: body.summary?.mistakes ?? 0,
      blunders: body.summary?.blunders ?? 0,
      inaccuracies: body.summary?.inaccuracies ?? 0,
      biggestMomentSkill,
      biggestMomentPly,
      openingName: body.summary?.openingName ?? null,
    };

    const upserted = await upsertGameReviewAnalysis(supabase, childId!, gameRef!, summary, { freeAnalysis, premiumAnalysis });

    // Skill signals: bumped ONLY the first time this game is EVER reviewed
    // by anyone at any tier (upserted.isNewRow) — never on a cache hit
    // (handled above, before generation even runs) and never again on a
    // later tier upgrade that generates additional content for an
    // already-reviewed game (that call updates the existing row, so
    // isNewRow is false).
    if (upserted?.isNewRow) {
      const apiSkillByPly: Record<number, string | undefined> = {};
      for (const [ply, m] of Object.entries(rawResult.mistakes)) apiSkillByPly[Number(ply)] = m.skill;
      const counts = skillWeaknessCountsFromFacts(
        body.mistakes.map((m) => ({ ply: m.ply, skillHint: m.skillHint })),
        apiSkillByPly
      );
      await bumpSkillWeaknesses(supabase, childId!, counts);
    }
  }

  return NextResponse.json(clientResult);
}
