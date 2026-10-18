/**
 * Fornitori con API compatibile OpenAI (OpenAI, Mistral, OpenRouter, ...).
 * Alternativa a Gemini selezionabile da configurazione; non gestisce l'audio.
 */

import { LlmError, parseJsonLoose, withRetry, type LlmProvider, type LlmRequest, type LlmResult } from "./llm";

export class OpenAICompatibleProvider implements LlmProvider {
  readonly supportsAudio = false;

  constructor(
    readonly name: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async generate(req: LlmRequest): Promise<LlmResult> {
    const text = req.parts.map((p) => ("text" in p ? p.text : "[messaggio vocale non supportato]")).join("\n");
    const body = {
      model: req.model,
      temperature: req.temperature ?? 0.1,
      messages: [
        { role: "system", content: req.system },
        ...req.history.map((t) => ({ role: t.role === "model" ? "assistant" : "user", content: t.text })),
        { role: "user", content: text },
      ],
      response_format: { type: "json_schema", json_schema: { name: "risposta", schema: req.schema } },
    };
    return withRetry(async () => {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        throw new LlmError(`${this.name} ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status === 429 || res.status >= 500);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
      };
      const raw = data.choices?.[0]?.message?.content ?? "";
      let json: unknown;
      try {
        json = parseJsonLoose(raw);
      } catch {
        throw new LlmError(`${this.name}: JSON non valido`, true);
      }
      return {
        json,
        raw,
        model: req.model,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          cachedInputTokens: data.usage?.prompt_tokens_details?.cached_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
          audioInputTokens: 0,
        },
      };
    });
  }
}
