/**
 * Gemini via Google AI Studio (chiave API) oppure Vertex AI in regione UE
 * (account di servizio). Per i dati dei minori in produzione: Vertex, UE.
 */

import { createSign } from "node:crypto";

import { LlmError, parseJsonLoose, withRetry, type LlmProvider, type LlmRequest, type LlmResult } from "./llm";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export type GeminiConfig =
  | { kind: "studio"; apiKey: string }
  | { kind: "vertex"; project: string; location: string; serviceAccount: ServiceAccount };

let cachedToken: { token: string; exp: number } | null = null;

async function vertexToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) throw new LlmError(`token Vertex: ${res.status}`, res.status >= 500);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";
  readonly supportsAudio = true;

  constructor(private readonly config: GeminiConfig) {}

  private async endpoint(model: string): Promise<{ url: string; headers: Record<string, string> }> {
    if (this.config.kind === "studio") {
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        headers: { "x-goog-api-key": this.config.apiKey },
      };
    }
    const { project, location, serviceAccount } = this.config;
    const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
    return {
      url: `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`,
      headers: { authorization: `Bearer ${await vertexToken(serviceAccount)}` },
    };
  }

  async generate(req: LlmRequest): Promise<LlmResult> {
    const contents = [
      ...req.history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
      {
        role: "user",
        parts: req.parts.map((p) =>
          "text" in p ? { text: p.text } : { inlineData: { mimeType: p.audio.mimeType, data: p.audio.base64 } },
        ),
      },
    ];
    const body = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.1,
        responseMimeType: "application/json",
        responseJsonSchema: req.schema,
      },
    };
    return withRetry(async () => {
      const { url, headers } = await this.endpoint(req.model);
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new LlmError(`Gemini ${res.status}: ${text.slice(0, 300)}`, res.status === 429 || res.status >= 500);
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          cachedContentTokenCount?: number;
          thoughtsTokenCount?: number;
          promptTokensDetails?: { modality: string; tokenCount: number }[];
        };
      };
      const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!raw) throw new LlmError("Gemini: risposta vuota", true);
      const u = data.usageMetadata ?? {};
      const audio = u.promptTokensDetails?.find((d) => d.modality === "AUDIO")?.tokenCount ?? 0;
      let json: unknown;
      try {
        json = parseJsonLoose(raw);
      } catch {
        throw new LlmError("Gemini: JSON non valido", true);
      }
      return {
        json,
        raw,
        model: req.model,
        usage: {
          inputTokens: u.promptTokenCount ?? 0,
          cachedInputTokens: u.cachedContentTokenCount ?? 0,
          outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
          audioInputTokens: audio,
        },
      };
    });
  }
}
