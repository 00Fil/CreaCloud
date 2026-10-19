"use server";

/**
 * Azioni sulle chat WhatsApp. L'invio di messaggi e allegati passa da
 * POST /api/whatsapp/send (vedi lib/whatsapp/model.ts); qui tutto il resto.
 *
 * CONTRATTO: firme e schemi sono fissati; i corpi segnati "da implementare"
 * vanno completati senza cambiare nomi, input o tipo di risultato.
 */

import { z } from "zod";

import { action, ActionError } from "@/lib/actions/safe";

const id = z.uuid();
const todo = (): never => {
  throw new ActionError("Funzione non ancora disponibile.");
};

/** Segna come letti i messaggi ricevuti (anche su WhatsApp: spunte blu) e azzera i non letti. */
export const markChatRead = action(z.object({ chatId: id }), async () => todo());

/** Rimette la chat tra quelle da leggere (solo nella dashboard). */
export const markChatUnread = action(z.object({ chatId: id }), async () => todo());

export const setChatPinned = action(z.object({ chatId: id, pinned: z.boolean() }), async () => todo());

export const setChatArchived = action(z.object({ chatId: id, archived: z.boolean() }), async () => todo());

/** "ai": l'assistente risponde; "manuale": solo lo staff. */
export const setChatMode = action(z.object({ chatId: id, mode: z.enum(["ai", "manuale"]) }), async () => todo());

/** Mette in pausa l'assistente per `hours` ore; null lo riattiva subito. */
export const pauseAi = action(z.object({ chatId: id, hours: z.number().int().min(1).max(72).nullable() }), async () => todo());

/** Toglie la chat da "da gestire". */
export const resolveChat = action(z.object({ chatId: id }), async () => todo());

/** Collega la chat a un genitore, studente o tutor (null per scollegare). */
export const linkChat = action(
  z.object({
    chatId: id,
    person: z.object({ kind: z.enum(["parent", "student", "tutor"]), id }).nullable(),
  }),
  async () => todo(),
);

/** Invia la bozza dell'assistente (eventualmente modificata). */
export const sendDraft = action(z.object({ messageId: id, text: z.string().trim().min(1).max(4096) }), async () => todo());

export const discardDraft = action(z.object({ messageId: id }), async () => todo());

/** Riprova l'invio di un messaggio andato in errore. */
export const retryMessage = action(z.object({ messageId: id }), async () => todo());

/** Reazione del centro a un messaggio; emoji vuota per toglierla. */
export const reactToMessage = action(z.object({ messageId: id, emoji: z.string().max(16) }), async () => todo());

/** Modifica un messaggio di testo inviato dal centro (entro 15 minuti). */
export const editMessage = action(z.object({ messageId: id, text: z.string().trim().min(1).max(4096) }), async () => todo());

/** Elimina per tutti un messaggio inviato dal centro. */
export const deleteMessage = action(z.object({ messageId: id }), async () => todo());

/** Inoltra un messaggio (testo o allegato) ad altre chat. */
export const forwardMessage = action(
  z.object({ messageId: id, chatIds: z.array(id).min(1).max(10) }),
  async (): Promise<{ sent: number }> => todo(),
);

/** "Sta scrivendo…" / "Sta registrando…" mostrato al contatto. */
export const setTyping = action(
  z.object({ chatId: id, state: z.enum(["composing", "recording", "paused"]) }),
  async () => todo(),
);

/** Apre (o crea) la chat con un numero di telefono. */
export const startChat = action(
  z.object({ phone: z.string().trim().min(6).max(32), name: z.string().trim().max(120).optional() }),
  async (): Promise<{ chatId: string }> => todo(),
);

/** Importa da WhatsApp i messaggi precedenti al primo salvato. */
export const loadHistory = action(z.object({ chatId: id }), async (): Promise<{ imported: number }> => todo());

/** Aggiorna la foto profilo del contatto. */
export const refreshAvatar = action(z.object({ chatId: id }), async () => todo());
