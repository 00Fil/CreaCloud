/** Conversioni tra identificativi WhatsApp (JID) e numeri usati dalla piattaforma. */

export interface KeyLike {
  remoteJid?: string | null;
  remoteJidAlt?: string | null;
}

const PN = "@s.whatsapp.net";
const LID = "@lid";

function user(jid: string): string {
  return jid.split("@")[0].split(":")[0];
}

/** "+39333…" se il numero è noto, altrimenti "lid:…". null per gruppi, stati, canali. */
export function phoneFromKey(key: KeyLike): string | null {
  const jid = key.remoteJid ?? "";
  if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast" || jid.endsWith("@newsletter") || jid.endsWith("@broadcast")) {
    return null;
  }
  if (jid.endsWith(PN)) return "+" + user(jid);
  const alt = key.remoteJidAlt ?? "";
  if (alt.endsWith(PN)) return "+" + user(alt);
  if (jid.endsWith(LID)) return "lid:" + user(jid);
  return null;
}

export function jidFromPhone(phone: string): string {
  if (phone.startsWith("lid:")) return phone.slice(4) + LID;
  return phone.replace(/[^\d]/g, "") + PN;
}

type AnyMessage = Record<string, any> | null | undefined;

/** Testo leggibile di un messaggio Baileys, e tipo di allegato se presente. */
export function extractContent(message: AnyMessage): { text: string; mediaType: string | null } {
  if (!message) return { text: "", mediaType: null };
  const inner = message.ephemeralMessage?.message ?? message.viewOnceMessage?.message ?? message;
  if (inner.conversation) return { text: inner.conversation, mediaType: null };
  if (inner.extendedTextMessage?.text) return { text: inner.extendedTextMessage.text, mediaType: null };
  if (inner.audioMessage) return { text: "", mediaType: inner.audioMessage.mimetype?.split(";")[0] ?? "audio/ogg" };
  if (inner.imageMessage) return { text: inner.imageMessage.caption ?? "", mediaType: "image" };
  if (inner.videoMessage) return { text: inner.videoMessage.caption ?? "", mediaType: "video" };
  if (inner.documentMessage) return { text: inner.documentMessage.caption ?? "", mediaType: "document" };
  if (inner.buttonsResponseMessage) return { text: inner.buttonsResponseMessage.selectedDisplayText ?? "", mediaType: null };
  if (inner.listResponseMessage) return { text: inner.listResponseMessage.title ?? "", mediaType: null };
  if (inner.reactionMessage || inner.protocolMessage || inner.senderKeyDistributionMessage) return { text: "", mediaType: "ignore" };
  if (inner.stickerMessage) return { text: "", mediaType: "sticker" };
  return { text: "", mediaType: "unknown" };
}

/** Ritardo "umano" prima dell'invio: più lungo per testi lunghi, con variazione casuale. */
export function humanDelayMs(text: string, rand = Math.random): number {
  const typing = Math.min(4000, 600 + text.length * 25);
  return Math.round(typing + rand() * 1500);
}
