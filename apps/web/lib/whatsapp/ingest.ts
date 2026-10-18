/** Registrazione di un messaggio in arrivo: chat, collegamento alla persona, deduplica. */

import { must, type Db } from "@/lib/db/util";

import type { InboundMessage } from "./types";

/** Minuti di silenzio dell'AI quando il coordinatore risponde dal telefono. */
const PHONE_TAKEOVER_MIN = 120;

async function linkByPhone(db: Db, phone: string) {
  const [p, s, t] = await Promise.all([
    db.from("parents").select("id, first_name, last_name").eq("phone", phone).maybeSingle(),
    db.from("students").select("id, first_name, last_name").eq("phone", phone).maybeSingle(),
    db.from("tutors").select("id, first_name, last_name").eq("phone", phone).maybeSingle(),
  ]);
  const person = (p.data ?? s.data ?? t.data) as { first_name: string; last_name: string } | null;
  return {
    parent_id: (p.data as { id: string } | null)?.id ?? null,
    student_id: p.data ? null : ((s.data as { id: string } | null)?.id ?? null),
    tutor_id: p.data || s.data ? null : ((t.data as { id: string } | null)?.id ?? null),
    name: person ? `${person.first_name} ${person.last_name}`.trim() : null,
  };
}

export async function ensureChat(db: Db, phone: string, name: string) {
  const existing = await db.from("chats").select("*").eq("phone", phone).maybeSingle();
  if (existing.data) return existing.data as { id: string; display_name: string; unread_count: number };
  const link = await linkByPhone(db, phone);
  const created = await db
    .from("chats")
    .insert({
      phone,
      display_name: link.name ?? name ?? "",
      parent_id: link.parent_id,
      student_id: link.student_id,
      tutor_id: link.tutor_id,
      needs_attention: !link.parent_id && !link.student_id && !link.tutor_id,
    })
    .select("*")
    .single();
  if (created.error) {
    // creata in parallelo da un altro webhook
    const again = must(await db.from("chats").select("*").eq("phone", phone).single(), "chat") as unknown;
    return again as { id: string; display_name: string; unread_count: number };
  }
  return created.data as { id: string; display_name: string; unread_count: number };
}

/** Restituisce gli id creati, o null se il messaggio era già stato registrato. */
export async function ingestInbound(
  db: Db,
  msg: InboundMessage,
): Promise<{ chatId: string; messageId: string; fromMe: boolean } | null> {
  const chat = await ensureChat(db, msg.phone, msg.name);
  const inserted = await db
    .from("messages")
    .insert({
      chat_id: chat.id,
      direction: msg.fromMe ? "out" : "in",
      author: msg.fromMe ? "telefono" : "utente",
      body: msg.text,
      media_type: msg.mediaType,
      media_ref: msg.mediaRef,
      provider: msg.provider,
      provider_message_id: msg.providerMessageId,
      status: msg.fromMe ? "inviato" : "ricevuto",
      created_at: msg.timestamp.toISOString(),
    })
    .select("id")
    .single();
  if (inserted.error) {
    if (inserted.error.code === "23505") return null;
    throw new Error(`messaggio: ${inserted.error.message}`);
  }
  const now = new Date();
  const preview = msg.text || (msg.mediaType?.startsWith("audio") ? "🎤 Messaggio vocale" : `[${msg.mediaType ?? "allegato"}]`);
  const patch: Record<string, unknown> = {
    last_message_at: now.toISOString(),
    last_message_preview: preview.slice(0, 120),
  };
  if (msg.fromMe) {
    patch.takeover_until = new Date(now.getTime() + PHONE_TAKEOVER_MIN * 60_000).toISOString();
  } else {
    patch.last_inbound_at = msg.timestamp.toISOString();
    patch.unread_count = (chat.unread_count ?? 0) + 1;
    if (!chat.display_name && msg.name) patch.display_name = msg.name;
  }
  must(await db.from("chats").update(patch).eq("id", chat.id), "aggiornamento chat");
  return { chatId: chat.id, messageId: (inserted.data as { id: string }).id, fromMe: msg.fromMe };
}

export async function updateDeliveryStatus(db: Db, provider: string, providerMessageId: string, status: string) {
  const map: Record<string, string> = { sent: "inviato", delivered: "consegnato", read: "letto", failed: "errore" };
  const s = map[status];
  if (!s) return;
  await db.from("messages").update({ status: s }).eq("provider", provider).eq("provider_message_id", providerMessageId);
}
