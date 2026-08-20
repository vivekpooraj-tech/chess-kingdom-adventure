import type { ProviderCall } from "./types";

// Development-only provider: Google's Gemini API via AI Studio. Chosen
// over alternatives (Groq, OpenAI, etc.) because Google's own docs
// (https://ai.google.dev/gemini-api/docs/rate-limits, fetched and
// confirmed directly, not just inferred) state the free tier "does not
// require billing" -- no credit card, no Google Cloud billing account,
// just an API key from https://aistudio.google.com. This is strictly a
// development convenience for testing Ollie without Anthropic credits;
// the production default remains Anthropic (see aiProvider.ts).
//
// GEMINI_MODEL default, verified against a real API key on 2026-08-20:
// gemini-2.5-flash (this app's original default) is RETIRED -- the API
// now returns 404 NOT_FOUND for it. Its replacements, gemini-3.6-flash and
// gemini-3.5-flash, are "thinking" models that spend a hidden token budget
// on internal reasoning before answering (confirmed live: both burned
// ~290 of a 300-token budget on thinking and returned truncated garbage,
// finishReason MAX_TOKENS) -- wrong fit for Ollie's short, simple answers
// unless maxOutputTokens is raised well past what a real answer needs.
// gemini-3.5-flash-lite does no hidden "thinking" (confirmed live:
// thoughtsTokenCount 0, finishReason STOP, ~1s), and produced a complete,
// accurate, well-toned answer within budget on the first try -- the
// better default for this use case. GEMINI_MODEL still overrides this.
const MIN_PLAUSIBLE_KEY_LENGTH = 20;
const PROVIDER_TIMEOUT_MS = 15_000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

export function hasUsableGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return !!key && key.length >= MIN_PLAUSIBLE_KEY_LENGTH;
}

export const callGemini: ProviderCall = async ({ systemPrompt, message, history }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.length < MIN_PLAUSIBLE_KEY_LENGTH) return null;

  // Gemini uses "model" instead of "assistant" for the AI's own turns, and
  // has no separate system-role message -- system instructions go in their
  // own top-level field.
  const contents = [
    ...history.map((turn) => ({
      role: turn.from === "child" ? "user" : "model",
      parts: [{ text: turn.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 300 },
        }),
        signal: controller.signal,
      }
    );

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!res.ok || !text) return null;
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};
