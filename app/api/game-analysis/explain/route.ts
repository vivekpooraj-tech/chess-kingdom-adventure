import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";

/**
 * Turns the engine's raw facts (which move, what category, what the engine
 * would have played instead) into the kid-friendly "why" prose the
 * post-game analysis screen shows — never exposes centipawn numbers or
 * engine-speak to the child (see section 16 of the brief this implements).
 * Same Claude call pattern as app/api/ai/coach/route.ts (raw fetch, same
 * model, same mock-fallback-when-no-key approach) — no new AI provider.
 */
const ANALYSIS_SYSTEM_PROMPT = `You are the Chess Mind post-game coach for a child aged 5-12. You are
warm, encouraging, and never say a child is "wrong" or "bad" — you explain what happened and what to
notice next time, like a kind teacher. You are given a list of specific moves from a game they just
played, each with facts a chess engine already determined (their move, the category, and — for
mistakes — the better move available). Your job is ONLY to explain WHY in simple language a 7-12 year
old can follow, and state ONE reusable chess principle per mistake. Never invent facts not given to
you (don't claim a piece was hanging if you weren't told so, don't invent threats). If multiple good
moves existed, say "one strong option was..." rather than claiming the given move is the only correct
one.

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape:
{
  "mistakes": { "<ply>": { "explanation": "...", "whatToNotice": "..." } },
  "goodMoves": { "<ply>": { "explanation": "..." } },
  "biggestLesson": "...",
  "insights": ["...", "..."]
}
"explanation" for a mistake: 1-2 short sentences on what went wrong in THIS position. "whatToNotice":
one short, reusable principle ("Before attacking, check whether your king is safe."). "explanation"
for a good move: 1 short encouraging sentence on what they saw. "biggestLesson": one sentence
summarizing the single most important thing from this specific game. "insights": 1-2 short, specific
lessons grounded in what actually happened in this game — never generic chess advice unrelated to the
moves given.`;

interface MistakeInput {
  ply: number;
  moveNumber: number;
  san: string;
  category: "mistake" | "blunder";
  bestMoveSan?: string;
  isCapture?: boolean;
  missedMate?: boolean;
  missedMaterial?: boolean;
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

function mockResponse(body: ExplainRequestBody) {
  const mistakes: Record<number, { explanation: string; whatToNotice: string }> = {};
  for (const m of body.mistakes) {
    mistakes[m.ply] = {
      explanation: `${m.san} gave your opponent a real chance to gain the upper hand here.`,
      whatToNotice: "Before you move, check what your opponent could do in response.",
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

    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Game analysis explanation call failed:", err);
    return NextResponse.json(mockResponse(body));
  }
}
