/** Trasporto WhatsApp tramite Waxum self-hosted (API v1, Waxum 0.16.0). */
import { createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import type { OutboundChannel } from "@/lib/agent/types";
import { normalizePhone, type InboundMessage } from "./types";

export interface WaxumConfig {
  url: string;
  token: string;
  sessionId: string;
  webhookUrl?: string;
  webhookSecret?: string;
  allowFirstContact?: boolean;
  paceSends?: boolean;
}

export function waxumConfigFromEnv(): WaxumConfig | null {
  const { WAXUM_URL, WAXUM_TOKEN, WAXUM_SESSION_ID, WAXUM_WEBHOOK_URL, WAXUM_WEBHOOK_SECRET } = process.env;
  if (!WAXUM_URL || !WAXUM_TOKEN || !WAXUM_SESSION_ID) return null;
  const url = new URL(WAXUM_URL);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("WAXUM_URL deve essere un URL HTTP(S) senza credenziali, query o fragment");
  }
  return {
    url: WAXUM_URL.replace(/\/+$/, "").replace(/\/api\/v1$/, ""),
    token: WAXUM_TOKEN, sessionId: WAXUM_SESSION_ID,
    webhookUrl: WAXUM_WEBHOOK_URL, webhookSecret: WAXUM_WEBHOOK_SECRET,
    allowFirstContact: process.env.ALLOW_FIRST_CONTACT === "true",
    paceSends: process.env.WAXUM_PACE_SENDS !== "false",
  };
}

export class WaxumError extends Error {
  constructor(public readonly status: number, public readonly retryAfter: string | null) {
    super(`Waxum HTTP ${status}${retryAfter ? ` (Retry-After: ${retryAfter})` : ""}`);
  }
}

/** Come il vecchio gateway: serializzazione locale, non una coda durevole. */
let sendQueue: Promise<unknown> = Promise.resolve();
export function humanDelayMs(text: string, rand = Math.random): number {
  return Math.round(Math.min(4000, 600 + text.length * 25) + rand() * 1500);
}

export class WaxumChannel implements OutboundChannel {
  readonly provider = "waxum";
  constructor(private readonly cfg: WaxumConfig) {}

  private get sessionPath() { return `/sessions/${encodeURIComponent(this.cfg.sessionId)}`; }

  private async request<T>(path: string, method = "GET", body?: unknown, timeoutMs = 60_000): Promise<T> {
    const res = await fetch(`${this.cfg.url}/api/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${this.cfg.token}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs), cache: "no-store",
      // Non inoltrare il Bearer a un host indicato da un redirect.
      redirect: "error",
    });
    if (!res.ok) throw new WaxumError(res.status, res.headers.get("retry-after"));
    if (res.status === 204) return undefined as T;
    return await res.json() as T;
  }

  async send(phone: string, text: string, opts?: { manual?: boolean; lastInboundAt?: string | null }) {
    if (!text.trim()) throw new Error("Testo del messaggio vuoto");
    // La protezione preesistente resta applicativa: Waxum non ha un campo `force`.
    if (!this.cfg.allowFirstContact && !opts?.manual && !opts?.lastInboundAt) {
      throw new Error("Il contatto non ha mai scritto al centro: primo contatto automatico non consentito");
    }
    const run = async () => {
      const to = recipientJid(phone);
      if (this.cfg.paceSends !== false) {
        const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
        await this.request(`${this.sessionPath}/presence/subscribe`, "POST", { jid }, 5_000).catch(() => undefined);
        await this.request(`${this.sessionPath}/chatstate/send`, "POST", { to: jid, state: "composing" }, 5_000).catch(() => undefined);
        await new Promise(resolve => setTimeout(resolve, humanDelayMs(text)));
        await this.request(`${this.sessionPath}/chatstate/send`, "POST", { to: jid, state: "paused" }, 5_000).catch(() => undefined);
      }
      const data = await this.request<{ message_id: string }>(`${this.sessionPath}/messages/text`, "POST", { to, text });
      if (!data.message_id) throw new Error("Waxum non ha restituito message_id: verificare prima di ritentare");
      // Nessun retry automatico: dopo un timeout il messaggio potrebbe essere già partito.
      return { providerMessageId: data.message_id };
    };
    const result = sendQueue.then(run, run);
    sendQueue = result.catch(() => undefined);
    return result;
  }

  async downloadMedia(ref: string): Promise<{ mimeType: string; base64: string } | null> {
    let parsed: unknown;
    try { parsed = JSON.parse(ref); } catch { return null; }
    const result = mediaReference.safeParse(parsed);
    if (!result.success || result.data.sessionId !== this.cfg.sessionId) return null;
    const { media, mimeType } = result.data;
    const data = await this.request<{ data: string; size: number }>(`${this.sessionPath}/media/download`, "POST", {
      direct_path: media.direct_path, media_key: media.media_key,
      file_sha256: media.file_sha256, file_enc_sha256: media.file_enc_sha256,
      file_length: media.file_length, media_type: media.kind,
    });
    return typeof data.data === "string" ? { mimeType, base64: data.data } : null;
  }

  /** GET puramente osservativo: non crea né ricollega una sessione. */
  async status(): Promise<{ state: string; qr: string | null; me: string | null }> {
    try {
      const s = await this.request<{ status: string; is_logged_in: boolean; socket_alive?: boolean; paused?: boolean; phone_number?: string }>(`${this.sessionPath}/status`, "GET", undefined, 8_000);
      let qr: string | null = null;
      if (["waiting_for_qr", "connecting", "connected"].includes(s.status) && !s.is_logged_in) {
        try {
          const q = await this.request<{ qr_codes: string[] }>(`${this.sessionPath}/qr`, "GET", undefined, 8_000);
          if (q.qr_codes?.length) qr = await QRCode.toDataURL(q.qr_codes[q.qr_codes.length - 1], { width: 320, margin: 2 });
        } catch (e) { if (!(e instanceof WaxumError && [404, 409].includes(e.status))) throw e; }
      }
      const state = s.paused ? "paused" : s.is_logged_in && s.socket_alive === false ? "socket_offline" : s.status;
      return { state, qr, me: s.phone_number ?? null };
    } catch (e) {
      if (e instanceof WaxumError) {
        if (e.status === 404) return { state: "missing", qr: null, me: null };
        if ([401, 403].includes(e.status)) return { state: "unauthorized", qr: null, me: null };
      }
      return { state: "unreachable", qr: null, me: null };
    }
  }

  /** Azione esplicita dello staff: crea se assente, assicura il webhook, ricollega. */
  async connect(): Promise<void> {
    if (!this.cfg.webhookUrl || !this.cfg.webhookSecret) throw new Error("WAXUM_WEBHOOK_URL e WAXUM_WEBHOOK_SECRET richiesti");
    try {
      await this.request(this.sessionPath);
    } catch (e) {
      if (!(e instanceof WaxumError && e.status === 404)) throw e;
      try {
        await this.request("/sessions", "POST", { id: this.cfg.sessionId, name: "CreaCloud" });
      } catch (createError) {
        if (!(createError instanceof WaxumError && createError.status === 409)) throw createError;
      }
    }
    const hooks = await this.request<{ webhooks: { id: string; url: string; secret?: string | null; events: string[]; enabled: boolean }[] }>(`${this.sessionPath}/webhooks`);
    const desiredEvents = ["message", "receipt", "connected", "disconnected", "logged_out", "account_locked"];
    const sameUrl = hooks.webhooks.filter(h => h.url === this.cfg.webhookUrl);
    const matching = sameUrl.find(h => h.secret === this.cfg.webhookSecret && desiredEvents.every(e => h.events.includes(e) || h.events.includes("all")));
    if (!matching) {
      // Waxum rifiuta URL duplicati (409): rimuovi solo la precedente
      // registrazione di QUESTA applicazione, poi ricreala con il nuovo segreto.
      for (const h of sameUrl) await this.request(`${this.sessionPath}/webhooks/${encodeURIComponent(h.id)}`, "DELETE");
      try {
        await this.request(`${this.sessionPath}/webhooks`, "POST", {
          url: this.cfg.webhookUrl, secret: this.cfg.webhookSecret, events: desiredEvents,
        });
      } catch (error) {
        // Best effort: ripristina la precedente configurazione se la scrittura fallisce.
        const previous = sameUrl[0];
        if (previous) await this.request(`${this.sessionPath}/webhooks`, "POST", {
          url: previous.url, secret: previous.secret, events: previous.events,
        }).catch(() => undefined);
        throw error;
      }
    } else {
      // Anche enabled=true può avere il circuit breaker aperto: enable lo azzera.
      await this.request(`${this.sessionPath}/webhooks/${encodeURIComponent(matching.id)}/enable`, "POST");
    }
    await this.request(`${this.sessionPath}/connect`, "POST", {});
  }

  /** Scollega il telefono, senza eliminare sessione, webhook o cronologia. */
  async logout(): Promise<void> { await this.request(`${this.sessionPath}/logout`, "POST"); }
}

export function recipientJid(phone: string): string {
  if (/^lid:\d+$/.test(phone)) return `${phone.slice(4)}@lid`;
  if (/^\d+@(lid|s\.whatsapp\.net)$/.test(phone)) return phone;
  const normalized = normalizePhone(phone);
  if (!/^\+[1-9]\d{5,14}$/.test(normalized)) throw new Error("Destinatario WhatsApp non valido");
  return normalized.slice(1);
}

const mediaMetadata = z.object({
  kind: z.enum(["image", "video", "audio", "document", "sticker"]),
  direct_path: z.string().min(1), media_key: z.string().min(1),
  file_sha256: z.string().min(1), file_enc_sha256: z.string().min(1),
  file_length: z.number().int().nonnegative(), mimetype: z.string().nullish(),
});
const mediaReference = z.object({ version: z.literal(1), sessionId: z.string(), mimeType: z.string(), media: mediaMetadata });
export const waxumEnvelope = z.object({
  session_id: z.string().min(1), event: z.string().min(1),
  timestamp: z.number().optional(), offline: z.boolean().optional(), data: z.record(z.string(), z.unknown()),
});
export type WaxumEnvelope = z.infer<typeof waxumEnvelope>;
const messageData = z.object({
  message_id: z.string().min(1), from: z.string().min(1),
  from_phone: z.string().nullish(), chat: z.string().nullish(), chat_phone: z.string().nullish(),
  is_from_me: z.boolean(), is_group: z.boolean().optional(), push_name: z.string().nullish(),
  message_type: z.string(), text: z.string().nullish(), caption: z.string().nullish(),
  selected_text: z.string().nullish(), selected_id: z.string().nullish(),
  media_mimetype: z.string().nullish(), media: z.unknown().optional(),
  timestamp: z.union([z.number(), z.string()]).nullish(),
});

function phoneFromJid(jid: string, resolved?: string | null): string | null {
  if (resolved && /^\d{6,15}$/.test(resolved)) return `+${resolved}`;
  if (/^\d+@lid$/.test(jid)) return `lid:${jid.split("@")[0]}`;
  if (/^\d+@s\.whatsapp\.net$/.test(jid)) return `+${jid.split("@")[0]}`;
  if (/^\+?\d{6,15}$/.test(jid)) return normalizePhone(jid);
  return null;
}

export function parseWaxumMessage(event: WaxumEnvelope): InboundMessage | null {
  if (event.event !== "message") return null;
  const m = messageData.parse(event.data);
  if (m.is_group || m.chat?.endsWith("@g.us")) return null;
  if (["reaction", "protocol", "sender_key_distribution", "poll_vote", "unknown"].includes(m.message_type)) return null;
  // from è il nostro numero per gli echo; la conversazione è identificata da chat.
  const jid = m.is_from_me ? m.chat : (m.chat ?? m.from);
  if (!jid) return null;
  const phone = phoneFromJid(jid, m.is_from_me ? m.chat_phone : (m.chat_phone ?? m.from_phone));
  if (!phone) return null; // esclude broadcast, status, newsletter e indirizzi di sistema
  const media = mediaMetadata.safeParse(m.media);
  const mediaType = m.media_mimetype?.split(";")[0] ?? (media.success ? media.data.mimetype?.split(";")[0] ?? `${media.data.kind}/${media.data.kind === "audio" ? "ogg" : "unknown"}` : null);
  let timestamp = new Date();
  if (m.timestamp != null) timestamp = typeof m.timestamp === "number" ? new Date(m.timestamp * 1000) : /^\d+$/.test(m.timestamp) ? new Date(Number(m.timestamp) * 1000) : new Date(m.timestamp);
  else if (event.timestamp != null) timestamp = new Date(event.timestamp * 1000);
  if (!Number.isFinite(timestamp.getTime())) throw new Error("Timestamp del messaggio non valido");
  const text = m.text ?? m.caption ?? m.selected_text ?? m.selected_id ?? "";
  return {
    provider: "waxum", providerMessageId: m.message_id, phone,
    name: m.is_from_me ? "" : m.push_name ?? "", text,
    mediaType: mediaType ?? (!["text", "conversation", "extended_text", "interactive_response", "buttons_response", "list_response", "template_button_reply"].includes(m.message_type) ? m.message_type : null),
    mediaRef: media.success ? JSON.stringify({ version: 1, sessionId: event.session_id, mimeType: mediaType ?? "application/octet-stream", media: media.data }) : null,
    fromMe: m.is_from_me, timestamp,
  };
}

/** HMAC v2: timestamp firmato + corpo grezzo. Nessun downgrade a v1. */
export function verifyWaxumSignature(raw: string, headers: Headers, secret: string, now = Date.now()): boolean {
  const ts = headers.get("x-webhook-timestamp");
  const signature = headers.get("x-webhook-signature");
  if (headers.get("x-webhook-signature-version") !== "v2" || !ts || !/^\d+$/.test(ts) || !signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature)) return false;
  if (Math.abs(Math.floor(now / 1000) - Number(ts)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${ts}.${raw}`).digest();
  const given = Buffer.from(signature.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Cloud via Waxum ha ricevute strutturate; linked-device oggi espone solo debug. */
export function parseWaxumReceipts(event: WaxumEnvelope): { id: string; status: string }[] {
  if (event.event !== "receipt") return [];
  const { message_id, status } = event.data;
  if (typeof message_id === "string" && typeof status === "string" && ["sent", "delivered", "read", "failed"].includes(status)) return [{ id: message_id, status }];
  // Non inventare consegna/lettura analizzando una stringa Rust Debug non stabile.
  return [];
}
