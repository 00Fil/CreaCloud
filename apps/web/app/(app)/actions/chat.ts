"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/staff";
import { sendToChat } from "@/lib/chat/send";
import { sessionClient } from "@/lib/db/clients";

const MANUAL_TAKEOVER_H = 2;

function refresh(chatId: string) {
  revalidatePath(`/chat/${chatId}`);
  revalidatePath("/chat");
}

export async function sendManual(formData: FormData) {
  await requireStaff();
  const chatId = String(formData.get("chatId"));
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  const db = await sessionClient();
  // quando scrive il coordinatore, l'assistente si fa da parte per un po'
  await db
    .from("chats")
    .update({ takeover_until: new Date(Date.now() + MANUAL_TAKEOVER_H * 3_600_000).toISOString(), needs_attention: false, unread_count: 0 })
    .eq("id", chatId);
  try {
    await sendToChat(chatId, text, "coordinatore");
  } finally {
    refresh(chatId);
  }
}

export async function setChatMode(formData: FormData) {
  await requireStaff();
  const chatId = String(formData.get("chatId"));
  const mode = String(formData.get("mode")) === "manuale" ? "manuale" : "ai";
  const db = await sessionClient();
  await db.from("chats").update({ mode, takeover_until: null }).eq("id", chatId);
  refresh(chatId);
}

export async function takeOver(formData: FormData) {
  await requireStaff();
  const chatId = String(formData.get("chatId"));
  const hours = Number(formData.get("hours") ?? 8);
  const db = await sessionClient();
  const until = hours > 0 ? new Date(Date.now() + hours * 3_600_000).toISOString() : null;
  await db.from("chats").update({ takeover_until: until }).eq("id", chatId);
  refresh(chatId);
}

export async function resolveChat(formData: FormData) {
  await requireStaff();
  const chatId = String(formData.get("chatId"));
  const db = await sessionClient();
  await db.from("chats").update({ needs_attention: false, unread_count: 0 }).eq("id", chatId);
  refresh(chatId);
}

export async function markRead(chatId: string) {
  await requireStaff();
  const db = await sessionClient();
  await db.from("chats").update({ unread_count: 0 }).eq("id", chatId).gt("unread_count", 0);
}

export async function sendDraft(formData: FormData) {
  await requireStaff();
  const messageId = String(formData.get("messageId"));
  const text = String(formData.get("text") ?? "").trim();
  const db = await sessionClient();
  const { data: draft } = await db.from("messages").select("chat_id, status").eq("id", messageId).single();
  if (!draft || draft.status !== "bozza") return;
  await db.from("messages").delete().eq("id", messageId);
  try {
    if (text) await sendToChat(draft.chat_id, text, "ai");
  } finally {
    refresh(draft.chat_id);
  }
}

export async function discardDraft(formData: FormData) {
  await requireStaff();
  const messageId = String(formData.get("messageId"));
  const db = await sessionClient();
  const { data } = await db.from("messages").delete().eq("id", messageId).eq("status", "bozza").select("chat_id").maybeSingle();
  if (data) refresh(data.chat_id);
}

export async function linkChat(formData: FormData) {
  await requireStaff();
  const chatId = String(formData.get("chatId"));
  const [kind, id] = String(formData.get("person") ?? "").split(":");
  const db = await sessionClient();
  const patch = { parent_id: null as string | null, student_id: null as string | null, tutor_id: null as string | null };
  if (kind === "parent") patch.parent_id = id;
  if (kind === "student") patch.student_id = id;
  if (kind === "tutor") patch.tutor_id = id;
  const { data: chat } = await db.from("chats").update(patch).eq("id", chatId).select("phone").single();
  // il numero resta salvato sulla persona: i prossimi messaggi vengono riconosciuti
  const table = kind === "parent" ? "parents" : kind === "student" ? "students" : kind === "tutor" ? "tutors" : null;
  if (table && chat?.phone && !chat.phone.startsWith("lid:")) await db.from(table).update({ phone: chat.phone }).eq("id", id);
  refresh(chatId);
}
