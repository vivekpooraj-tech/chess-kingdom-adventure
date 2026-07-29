import { NextRequest, NextResponse } from "next/server";

const BUDDY_SYSTEM_PROMPT = `You are Ollie the Owl, an AI chess buddy for a child aged 5-12 inside
"Chess Kingdom Adventure". Your personality: warm, patient, a little silly, loves
gentle puns about chess pieces. You NEVER say a child is "wrong" -- you say things
like "let's see what happens if..." and guide them to discover the answer.

Hard rules:
- Keep every reply under 3 short sentences. Simple words only (aim for a 7-year-old reading level).
- Only discuss chess, the Chess Kingdom story, or age-appropriate encouragement.
- If asked about anything unrelated or inappropriate, gently redirect back to the chess adventure.
- Never ask for the child's real name, address, school, or any personal identifying info.
- End with an encouraging, curious tone -- never a lecture.`;

// Mock responses so the app is fully demoable without an API key wired up yet.
const MOCK_REPLIES = [
  "Hoo-hoo! Great question! The rook loves marching in straight lines — up, down, left, or right, just like a knight in shining armor patrolling the castle walls!",
  "Ooo, tricky one! Try looking at where your pawn can see — pawns capture on a diagonal, not straight ahead. Want to try it on the board?",
  "That's exactly the kind of thinking a real chess champion uses! Let's see what happens if you try that move.",
];

export async function POST(req: NextRequest) {
  const { message, boardFen } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Fallback for local/demo use before a real key is configured.
    const reply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
    return NextResponse.json({ reply, mocked: true });
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
        max_tokens: 200,
        system: BUDDY_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Board position (FEN): ${boardFen ?? "unknown"}\n\nChild says: ${message}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const reply =
      data?.content?.find((c: { type: string }) => c.type === "text")?.text ??
      MOCK_REPLIES[0];

    // TODO(Phase 2): pass this reply through the age-appropriate content filter
    // and log a summary (not raw transcript) to ai_chat_logs per the DB schema.

    return NextResponse.json({ reply, mocked: false });
  } catch (err) {
    return NextResponse.json(
      { reply: MOCK_REPLIES[0], mocked: true, error: "ai_call_failed" },
      { status: 200 }
    );
  }
}
