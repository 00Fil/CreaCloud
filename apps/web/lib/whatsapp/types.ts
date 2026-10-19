export type WhatsAppProvider = "waxum";

/** Messaggio in arrivo normalizzato, indipendente dal canale. */
export interface InboundMessage {
  provider: WhatsAppProvider;
  providerMessageId: string;
  /** "+39333…" oppure "lid:…" quando WhatsApp nasconde il numero */
  phone: string;
  name: string;
  text: string;
  mediaType: string | null;
  mediaRef: string | null;
  /** inviato dal telefono del centro (solo canale non ufficiale) */
  fromMe: boolean;
  timestamp: Date;
}

/** Numero in formato E.164; i numeri italiani senza prefisso diventano +39. */
export function normalizePhone(input: string): string {
  const raw = input.trim();
  if (raw.startsWith("lid:")) return raw;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (digits.startsWith("+")) return digits;
  if (/^3\d{8,9}$/.test(digits)) return "+39" + digits;
  return "+" + digits;
}
