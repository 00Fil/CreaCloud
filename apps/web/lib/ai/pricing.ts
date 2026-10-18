import type { LlmUsage } from "./llm";

/** Prezzi in USD per milione di token. Aggiornabili con AI_PRICING_JSON. */
export interface ModelPrice {
  input: number;
  cachedInput: number;
  audioInput: number;
  output: number;
}

const DEFAULTS: Record<string, ModelPrice> = {
  "gemini-3.1-flash-lite": { input: 0.25, cachedInput: 0.025, audioInput: 0.5, output: 1.5 },
  "gemini-3-flash": { input: 0.5, cachedInput: 0.05, audioInput: 1.0, output: 3.0 },
  "gemini-2.5-flash-lite": { input: 0.1, cachedInput: 0.01, audioInput: 0.3, output: 0.4 },
  "gemini-2.5-flash": { input: 0.3, cachedInput: 0.03, audioInput: 1.0, output: 2.5 },
};

const FALLBACK: ModelPrice = { input: 1, cachedInput: 0.1, audioInput: 2, output: 5 };

function table(): Record<string, ModelPrice> {
  const extra = process.env.AI_PRICING_JSON;
  if (!extra) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...(JSON.parse(extra) as Record<string, ModelPrice>) };
  } catch {
    return DEFAULTS;
  }
}

export function priceFor(model: string): ModelPrice {
  const t = table();
  const key = Object.keys(t)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? t[key] : FALLBACK;
}

/** Costo in micro-dollari (1e-6 USD), per tenere interi nel database. */
export function costMicroUsd(model: string, u: LlmUsage): number {
  const p = priceFor(model);
  const plainText = Math.max(0, u.inputTokens - u.cachedInputTokens - u.audioInputTokens);
  const usd =
    plainText * p.input + u.cachedInputTokens * p.cachedInput + u.audioInputTokens * p.audioInput + u.outputTokens * p.output;
  return Math.round(usd);
}

/** Cambio prudenziale USD→EUR per il tetto di spesa (aggiornabile con AI_USD_EUR). */
export function microUsdToEur(micro: number): number {
  const rate = Number(process.env.AI_USD_EUR ?? "0.95");
  return (micro / 1_000_000) * rate;
}
