import type { ProviderCall } from "./types";

// A real Anthropic key is a long opaque token (100+ chars) -- anything
// shorter (an unfilled ".env" placeholder) can never be valid, and sending
// it would just burn a network round trip on a guaranteed failure.
const MIN_PLAUSIBLE_KEY_LENGTH = 40;
const PROVIDER_TIMEOUT_MS = 15_000;

// Configurable without a code change/redeploy for the model id specifically.
// No @anthropic-ai/sdk is installed in this project (raw fetch is used
// instead), so there's no SDK-side model list to check against; this is
// the app's current default per its own model documentation. The client
// can never override this -- it's read only from the server environment.
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export function hasUsableAnthropicKey(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key.length >= MIN_PLAUSIBLE_KEY_LENGTH;
}

export const callAnthropic: ProviderCall = async ({ systemPrompt, message, history }) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < MIN_PLAUSIBLE_KEY_LENGTH) return null;

  const messages = [
    ...history.map((turn) => ({
      role: turn.from === "child" ? ("user" as const) : ("assistant" as const),
      content: turn.text,
    })),
    { role: "user" as const, content: message },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 300,
        system: systemPrompt,
        messages,
      }),
      signal: controller.signal,
    });

    const data = await res.json();
    const text = data?.content?.find((c: { type: string }) => c.type === "text")?.text?.trim();

    if (!res.ok || !text) return null;
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};
