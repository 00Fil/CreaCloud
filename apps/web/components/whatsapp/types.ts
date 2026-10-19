/**
 * Contratto tra la conversazione (elenco messaggi) e il compositore.
 *
 * Flusso di invio:
 *  1. il compositore crea un messaggio ottimistico con un id nuovo
 *     (crypto.randomUUID()) e chiama `onOptimistic`: la bolla compare subito,
 *     con l'anteprima locale dell'allegato (`localUrl`) e l'avanzamento;
 *  2. invia a POST /api/whatsapp/send con lo stesso `id` (vedi lib/whatsapp/model.ts),
 *     aggiornando l'avanzamento con `onProgress`;
 *  3. chiama `onSettled` con la riga salvata, o con l'errore. Anche Realtime
 *     consegna la stessa riga: la conversazione la unisce per `id`.
 */

import type { Chat, ChatMessage } from "@/lib/whatsapp/model";

/** Messaggio come lo mostra la conversazione, anche prima che il server lo salvi. */
export type UiMessage = ChatMessage & {
  /** URL locale (blob:) dell'allegato appena scelto, finché non è nello storage */
  localUrl?: string | null;
  /** avanzamento del caricamento 0–1 */
  progress?: number | null;
  /** creato nel browser, non ancora confermato dal server */
  optimistic?: boolean;
};

export interface ComposerProps {
  chat: Pick<Chat, "id" | "display_name" | "phone" | "mode" | "wa_jid">;
  /** messaggio a cui si sta rispondendo (barra sopra il campo) */
  replyTo: UiMessage | null;
  onCancelReply: () => void;
  /** messaggio di testo del centro in modifica (il campo mostra il suo testo) */
  editing: UiMessage | null;
  onCancelEdit: () => void;
  onOptimistic: (message: UiMessage) => void;
  onProgress: (id: string, progress: number) => void;
  onSettled: (result: { id: string; message: UiMessage } | { id: string; error: string }) => void;
  /** se valorizzato, il compositore è disattivato e mostra il motivo */
  disabledReason?: string | null;
}

/** Selettore emoji condiviso (compositore e reazioni). */
export interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
}
