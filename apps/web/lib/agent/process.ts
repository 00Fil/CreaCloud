import "server-only";

import { serviceClient } from "@/lib/db/clients";
import { agentDeps } from "@/lib/runtime";
import type { WhatsAppProvider } from "@/lib/whatsapp/types";

import { handleInbound } from "./pipeline";

/** Attesa prima di rispondere: chi scrive spesso manda più messaggi di fila. */
const DEBOUNCE_MS = Number(process.env.AGENT_DEBOUNCE_MS ?? 6000);

export async function processInbound(chatId: string, messageId: string, provider: WhatsAppProvider) {
  await new Promise((r) => setTimeout(r, DEBOUNCE_MS));
  const db = serviceClient();
  const latest = await db
    .from("messages")
    .select("id")
    .eq("chat_id", chatId)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // è arrivato un messaggio più recente: risponderà quello, leggendo anche questo
  if (latest.data && latest.data.id !== messageId) return;
  try {
    const deps = await agentDeps(provider);
    await handleInbound(deps, chatId, messageId);
  } catch (e) {
    console.error("agente:", e);
    await db.from("chats").update({ needs_attention: true }).eq("id", chatId);
  }
}
