/**
 * Modello dei messaggi WhatsApp condiviso da server e interfaccia.
 *
 * Invio dal browser: POST /api/whatsapp/send (multipart/form-data)
 *   id          uuid generato dal browser (riga ottimistica, evita doppioni)
 *   chatId      uuid della chat
 *   kind        "testo" | "immagine" | "video" | "audio" | "vocale" | "documento" | "posizione" | "contatto"
 *   text        testo del messaggio o didascalia dell'allegato
 *   file        allegato (immagine, video, audio, vocale, documento)
 *   duration    secondi (vocale, audio, video)
 *   waveform    JSON di 64 interi 0–100 (vocale)
 *   width, height  dimensioni (immagine, video)
 *   location    JSON LocationData (posizione)
 *   contact     JSON ContactData (contatto)
 *   replyTo     uuid del messaggio a cui si risponde
 * Risposta: { ok: true, message: ChatMessage } | { ok: false, error: string }
 *
 * Allegati: GET /api/media/{messageId} reindirizza a un URL firmato dello
 * storage (con ?download=1 forza lo scaricamento con il nome del file).
 * Foto profilo: GET /api/media/avatar/{chatId}.
 */

import type { Tables } from "@/lib/db/types";

export type MessageKind =
  | "testo"
  | "immagine"
  | "video"
  | "audio"
  | "vocale"
  | "documento"
  | "sticker"
  | "posizione"
  | "contatto"
  | "sondaggio"
  | "sistema"
  | "altro";

export type SendableKind = "testo" | "immagine" | "video" | "audio" | "vocale" | "documento" | "posizione" | "contatto";

export type MessageStatus = "ricevuto" | "bozza" | "in_invio" | "inviato" | "consegnato" | "letto" | "errore";

export type MessageAuthor = "utente" | "ai" | "coordinatore" | "telefono" | "sistema";

export type MediaStatus = "in_attesa" | "pronto" | "errore" | "non_disponibile";

export interface Reaction {
  /** "noi": il centro; "loro": il contatto */
  from: "noi" | "loro";
  emoji: string;
  at: string;
  /** staff che ha reagito (solo "noi") */
  by?: string | null;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  name?: string | null;
  address?: string | null;
  url?: string | null;
}

export interface ContactData {
  display_name: string;
  phones: { number: string; type?: string }[];
  organization?: string | null;
}

/** Riga di `messages` come la usa l'interfaccia. */
export type ChatMessage = Tables<"messages">;
export type Chat = Tables<"chats">;

/** Colonne lette dall'interfaccia (tutte tranne quelle interne dell'AI). */
export const MESSAGE_COLUMNS =
  "id, chat_id, direction, author, body, kind, media_type, media_ref, media_path, media_mime, media_size, media_name, media_duration, media_width, media_height, media_waveform, media_status, location, contact, quoted_message_id, quoted_provider_id, reactions, edited_at, deleted_at, sent_by, transcript, provider, provider_message_id, status, error, created_at";

export const CHAT_COLUMNS =
  "id, phone, display_name, parent_id, student_id, tutor_id, mode, takeover_until, last_inbound_at, last_message_at, last_message_preview, unread_count, needs_attention, wa_jid, avatar_path, avatar_checked_at, pinned_at, archived_at, typing_state, typing_at, created_at";

/** Limite degli allegati inviati dal centro (WhatsApp ne accetta di più solo per i documenti). */
export const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;

/** Finestra in cui WhatsApp permette di modificare un messaggio inviato. */
export const EDIT_WINDOW_MS = 15 * 60_000;

export const KIND_LABEL: Record<MessageKind, string> = {
  testo: "Messaggio",
  immagine: "Foto",
  video: "Video",
  audio: "Audio",
  vocale: "Messaggio vocale",
  documento: "Documento",
  sticker: "Sticker",
  posizione: "Posizione",
  contatto: "Contatto",
  sondaggio: "Sondaggio",
  sistema: "Avviso",
  altro: "Messaggio non supportato",
};

const KIND_ICON: Partial<Record<MessageKind, string>> = {
  immagine: "📷",
  video: "🎥",
  audio: "🎵",
  vocale: "🎤",
  documento: "📄",
  sticker: "💟",
  posizione: "📍",
  contatto: "👤",
  sondaggio: "📊",
};

function duration(seconds: number | null | undefined) {
  if (!seconds) return "";
  const s = Math.round(seconds);
  return ` (${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")})`;
}

/** Anteprima di una riga per l'elenco chat: "📷 Foto", "🎤 Messaggio vocale (0:12)", "📄 orario.pdf". */
export function messagePreview(m: {
  kind: string;
  body: string;
  media_name?: string | null;
  media_duration?: number | null;
  contact?: unknown;
  location?: unknown;
  deleted_at?: string | null;
}): string {
  if (m.deleted_at) return "🚫 Messaggio eliminato";
  const kind = m.kind as MessageKind;
  const icon = KIND_ICON[kind];
  if (kind === "testo" || !icon) return m.body || KIND_LABEL[kind] || "";
  const body = m.body?.trim();
  if (kind === "vocale" || kind === "audio") return `${icon} ${KIND_LABEL[kind]}${duration(m.media_duration)}`;
  if (kind === "documento") return `${icon} ${body || m.media_name || KIND_LABEL.documento}`;
  if (kind === "contatto") return `${icon} ${(m.contact as ContactData | null)?.display_name ?? KIND_LABEL.contatto}`;
  if (kind === "posizione") return `${icon} ${(m.location as LocationData | null)?.name || KIND_LABEL.posizione}`;
  return `${icon} ${body || KIND_LABEL[kind]}`;
}

/** Tipo di messaggio da inviare per un file scelto dall'utente. */
export function kindForFile(mime: string, asDocument = false): SendableKind {
  if (asDocument) return "documento";
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp") return "immagine";
  // WhatsApp riproduce solo MP4 (H.264/AAC) e 3GP: gli altri video vanno come documento.
  if (mime === "video/mp4" || mime === "video/3gpp") return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "documento";
}

/** Il messaggio è nostro (centro: AI, coordinatore o telefono del centro). */
export function isOutgoing(m: { direction: string }) {
  return m.direction === "out";
}

export function reactionsOf(m: { reactions: unknown }): Reaction[] {
  return Array.isArray(m.reactions) ? (m.reactions as Reaction[]) : [];
}
