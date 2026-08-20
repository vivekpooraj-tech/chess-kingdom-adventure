import type { ChatTurn } from "./types";
import { localFallbackReply } from "./localFallback";
import { callAnthropic, hasUsableAnthropicKey } from "./providers/anthropic";
import { callGemini, hasUsableGeminiKey } from "./providers/gemini";

export type OllieProviderName = "anthropic" | "development" | "fallback";

export interface OllieResponse {
  text: string;
  provider: OllieProviderName;
  usedFallback: boolean;
}

/**
 * Server-only provider selection -- the client sends no provider
 * preference and this never reads anything from the request body. Unset
 * OLLIE_AI_PROVIDER falls back to "anthropic" whenever a usable Anthropic
 * key is configured, which is exactly today's production behavior with
 * zero required env changes; only an explicit
 * OLLIE_AI_PROVIDER=development opts a deployment into the free
 * development provider.
 */
function getSelectedProvider(): OllieProviderName {
  const configured = process.env.OLLIE_AI_PROVIDER;
  if (configured === "anthropic" || configured === "development" || configured === "fallback") {
    return configured;
  }
  return hasUsableAnthropicKey() ? "anthropic" : "fallback";
}

/**
 * Single entry point the route calls -- it never talks to a provider
 * directly. Priority: selected provider -> local fallback KB (itself
 * either a genuine topic match or an honest "not sure" reply, never a
 * guess) -- so a provider outage never corrupts the conversation and
 * never returns a stale/unrelated answer.
 */
export async function generateOllieResponse(params: {
  systemPrompt: string;
  message: string;
  history: ChatTurn[];
}): Promise<OllieResponse> {
  const provider = getSelectedProvider();

  if (provider === "anthropic") {
    const text = await callAnthropic(params);
    if (text) return { text, provider: "anthropic", usedFallback: false };
  } else if (provider === "development") {
    const text = await callGemini(params);
    if (text) return { text, provider: "development", usedFallback: false };
  }

  return {
    text: localFallbackReply(params.message, params.history),
    provider: "fallback",
    usedFallback: true,
  };
}

// Exposed for the provider-selection test script only -- never sent to the client.
export const __testables = { getSelectedProvider, hasUsableAnthropicKey, hasUsableGeminiKey };
