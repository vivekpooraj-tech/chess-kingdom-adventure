import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";
import { ALL_SKILL_IDS, type SkillId } from "@/lib/analysis/skills";

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
  "mistakes": { "<ply>": { "explanation": "...", "whatToNotice": "...", "skill": "<skill_id>" } },
  "goodMoves": { "<ply>": { "explanation": "..." } },
  "biggestLesson": "...",
  "insights": ["...", "..."]
}
"explanation" for a mistake: 1-2 short sentences on what went wrong in THIS position. "whatToNotice":
one short, reusable principle ("Before attacking, check whether your king is safe."). "skill": one id
from the list above. "explanation" for a good move: 1 short encouraging sentence on what they saw.
"biggestLesson": one sentence summarizing the single most important thing from this specific game.
"insights": 1-2 short, specific lessons grounded in what actually happened in this game — never
generic chess advice unrelated to the moves given.`;

interface MistakeInput {
  ply: number;
  moveNumber: number;
  san: string;
  category: "mistake" | "blunder";
  bestMoveSan?: string;
  isCapture?: boolean;
  missedMate?: boolean;
  missedMaterial?: boolean;
  /** Conservative skill guess from lib/analysis/skillMapping.ts. */
  skillHint?: string;
  skillConfidence?: "high" | "medium" | "low";
}

interface GoodMoveInput {
  ply: number;
  moveNumber: number;
  san: string;
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
  const mistakes: Record<number, { explanation: string; whatToNotice: string; skill: SkillId }> = {};
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

  const mistakes: Record<number, { explanation: string; whatToNotice: string; skill: SkillId }> = {};
  for (const m of body.mistakes) {
    const r = rawMistakes[String(m.ply)] ?? {};
    mistakes[m.ply] = {
      explanation: typeof r.explanation === "string" && r.explanation.trim() ? r.explanation.trim() : FALLBACK_EXPLANATION,
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

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ExplainRequestBody | null;
  if (!body || !Array.isArray(body.mistakes) || !Array.isArray(body.goodMoves)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || (body.mistakes.length === 0 && body.goodMoves.length === 0)) {
    return NextResponse.json(mockResponse(body));
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
        max_tokens: 1500,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `${BRAND.name} game analysis. Context: ${JSON.stringify(body.context)}\n\nMistakes: ${JSON.stringify(
              body.mistakes
            )}\n\nGood moves: ${JSON.stringify(body.goodMoves)}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text = data?.content?.find((c: { type: string }) => c.type === "text")?.text;
    if (!text) return NextResponse.json(mockResponse(body));

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(mockResponse(body));
    }
    return NextResponse.json(normalizeParsed(parsed, body));
  } catch (err) {
    console.error("Game analysis explanation call failed:", err);
    return NextResponse.json(mockResponse(body));
  }
}
