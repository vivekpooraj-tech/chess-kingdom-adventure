import type { ChatTurn } from "../types";

export interface ProviderCallParams {
  systemPrompt: string;
  message: string;
  history: ChatTurn[];
}

/**
 * A provider adapter never throws to its caller -- any network error,
 * non-OK response, or empty/malformed reply is caught internally and
 * reported as `null`, so lib/ollie/aiProvider.ts can treat every provider
 * uniformly (try it, get text or null, decide what's next) without a
 * try/catch per provider at the call site.
 */
export type ProviderCall = (params: ProviderCallParams) => Promise<string | null>;
