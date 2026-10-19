import "server-only";

import type { MessageAuthor } from "@/lib/agent/types";
import { serviceClient } from "@/lib/db/clients";
import { channelFor } from "@/lib/runtime";
import type { WhatsAppProvider } from "@/lib/whatsapp/types";

/**
 * Invio di un messaggio in una chat, sul canale da cui la persona ha scritto
 * l'ultima volta (o quello attivo). `manual`: scritto o approvato da una persona.
 */
export async function sendToChat(chatId: string, text: string, author: MessageAuthor, manual = true) {
  const db = serviceClient();
  const { data: chat } = await db.from("chats").select("id, phone, last_inbound_at").eq("id", chatId).single();
  if (!chat) throw new Error("chat non trovata");
  const provider: WhatsAppProvider = "waxum";
  const channel = channelFor(provider);
  const { data: row, error } = await db
    .from("messages")
    .insert({ chat_id: chatId, direction: "out", author, body: text, provider, status: "in_invio" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  try {
    const res = await channel.send(chat.phone, text, { lastInboundAt: chat.last_inbound_at, manual });
    await db.from("messages").update({ status: "inviato", provider_message_id: res.providerMessageId }).eq("id", row.id);
  } catch (e) {
    await db.from("messages").update({ status: "errore", error: String(e).slice(0, 500) }).eq("id", row.id);
    throw e;
  } finally {
    await db
      .from("chats")
      .update({ last_message_at: new Date().toISOString(), last_message_preview: text.slice(0, 120) })
      .eq("id", chatId);
  }
}
