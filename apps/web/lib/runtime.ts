/** Composizione delle dipendenze reali: canale WhatsApp attivo e modelli AI da configurazione. */

import "server-only";

import type { AgentDeps } from "@/lib/agent/pipeline";
import type { Message, OutboundChannel } from "@/lib/agent/types";
import { GeminiProvider } from "@/lib/ai/gemini";
import type { LlmProvider } from "@/lib/ai/llm";
import { OpenAICompatibleProvider } from "@/lib/ai/openai-compatible";
import { serviceClient } from "@/lib/db/clients";
import { loadSettings, SupabaseRepo } from "@/lib/db/repo";
import type { Db } from "@/lib/db/util";
import { CloudChannel, cloudConfigFromEnv } from "@/lib/whatsapp/cloud";
import { GatewayChannel, gatewayConfigFromEnv } from "@/lib/whatsapp/gateway";
import type { WhatsAppProvider } from "@/lib/whatsapp/types";

export function channelFor(provider: WhatsAppProvider): CloudChannel | GatewayChannel {
  if (provider === "cloud") {
    const cfg = cloudConfigFromEnv();
    if (!cfg) throw new Error("Cloud API non configurata (WA_CLOUD_*)");
    return new CloudChannel(cfg);
  }
  const cfg = gatewayConfigFromEnv();
  if (!cfg) throw new Error("gateway non configurato (WA_GATEWAY_URL, WA_GATEWAY_TOKEN)");
  return new GatewayChannel(cfg);
}

export async function activeChannel(db: Db): Promise<OutboundChannel> {
  const settings = await loadSettings(db);
  return channelFor(settings.whatsappProvider);
}

function llmProvider(): LlmProvider {
  const kind = process.env.AI_PROVIDER ?? "gemini";
  if (kind === "openai-compatible") {
    const { AI_BASE_URL, AI_API_KEY } = process.env;
    if (!AI_BASE_URL || !AI_API_KEY) throw new Error("AI_BASE_URL e AI_API_KEY richiesti");
    return new OpenAICompatibleProvider("openai-compatible", AI_BASE_URL, AI_API_KEY);
  }
  const { VERTEX_PROJECT, VERTEX_LOCATION, GOOGLE_SERVICE_ACCOUNT_JSON, GEMINI_API_KEY } = process.env;
  if (VERTEX_PROJECT && GOOGLE_SERVICE_ACCOUNT_JSON) {
    return new GeminiProvider({
      kind: "vertex",
      project: VERTEX_PROJECT,
      location: VERTEX_LOCATION ?? "europe-west8",
      serviceAccount: JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON),
    });
  }
  if (GEMINI_API_KEY) return new GeminiProvider({ kind: "studio", apiKey: GEMINI_API_KEY });
  throw new Error("nessun fornitore AI configurato (VERTEX_* o GEMINI_API_KEY)");
}

/** `replyVia`: rispondi sullo stesso canale da cui è arrivato il messaggio. */
export async function agentDeps(replyVia?: WhatsAppProvider): Promise<AgentDeps> {
  const db = serviceClient();
  const provider = llmProvider();
  const channel = replyVia ? channelFor(replyVia) : await activeChannel(db);
  return {
    repo: new SupabaseRepo(db),
    channel,
    fast: { provider, model: process.env.AI_MODEL_FAST ?? "gemini-3.1-flash-lite" },
    smart: { provider, model: process.env.AI_MODEL_SMART ?? "gemini-3-flash" },
    audio: async (m: Message) => {
      const ref = m.media_ref;
      if (!ref) return null;
      const row = await db.from("messages").select("provider").eq("id", m.id).single();
      const ch = channelFor((row.data?.provider ?? "baileys") as WhatsAppProvider);
      return ch.downloadMedia(ref);
    },
  };
}
