/**
 * Strato indipendente dal fornitore AI. Il modello restituisce sempre JSON
 * conforme a uno schema: il resto del sistema non legge mai testo libero.
 */

export type LlmPart = { text: string } | { audio: { mimeType: string; base64: string } };

export interface LlmTurn {
  role: "user" | "model";
  text: string;
}

export interface LlmRequest {
  model: string;
  system: string;
  history: LlmTurn[];
  parts: LlmPart[];
  schema: Record<string, unknown>;
  temperature?: number;
}

export interface LlmUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  audioInputTokens: number;
}

export interface LlmResult {
  json: unknown;
  raw: string;
  usage: LlmUsage;
  model: string;
}

export interface LlmProvider {
  readonly name: string;
  readonly supportsAudio: boolean;
  generate(req: LlmRequest): Promise<LlmResult>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

export function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  return JSON.parse(trimmed);
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!(e instanceof LlmError) || !e.retryable) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw last;
}
