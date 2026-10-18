/**
 * WhatsApp Business Cloud API (Meta), canale ufficiale per la produzione.
 * Oltre 24 ore dall'ultimo messaggio dell'utente si può scrivere solo con un
 * modello approvato: in quel caso si usa WA_TEMPLATE_NAME con il testo come
 * parametro.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import type { OutboundChannel } from "@/lib/agent/types";

import { normalizePhone, type InboundMessage } from "./types";

const GRAPH = "https://graph.facebook.com/v23.0";

export interface CloudConfig {
  token: string;
  phoneNumberId: string;
  appSecret: string;
  verifyToken: string;
  templateName?: string;
  templateLanguage?: string;
}

export function cloudConfigFromEnv(): CloudConfig | null {
  const { WA_CLOUD_TOKEN, WA_CLOUD_PHONE_NUMBER_ID, WA_CLOUD_APP_SECRET, WA_CLOUD_VERIFY_TOKEN } = process.env;
  if (!WA_CLOUD_TOKEN || !WA_CLOUD_PHONE_NUMBER_ID || !WA_CLOUD_APP_SECRET || !WA_CLOUD_VERIFY_TOKEN) return null;
  return {
    token: WA_CLOUD_TOKEN,
    phoneNumberId: WA_CLOUD_PHONE_NUMBER_ID,
    appSecret: WA_CLOUD_APP_SECRET,
    verifyToken: WA_CLOUD_VERIFY_TOKEN,
    templateName: process.env.WA_TEMPLATE_NAME,
    templateLanguage: process.env.WA_TEMPLATE_LANGUAGE ?? "it",
  };
}

export class CloudChannel implements OutboundChannel {
  readonly provider = "cloud";

  constructor(private readonly cfg: CloudConfig) {}

  async send(phone: string, text: string, opts?: { lastInboundAt?: string | null }) {
    const to = phone.replace(/^\+/, "");
    const windowOpen = opts?.lastInboundAt && Date.now() - new Date(opts.lastInboundAt).getTime() < 23.5 * 3_600_000;
    const body =
      windowOpen || !this.cfg.templateName
        ? { messaging_product: "whatsapp", to, type: "text", text: { body: text, preview_url: false } }
        : {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: this.cfg.templateName,
              language: { code: this.cfg.templateLanguage },
              components: [{ type: "body", parameters: [{ type: "text", text: text.slice(0, 1000) }] }],
            },
          };
    const res = await fetch(`${GRAPH}/${this.cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.cfg.token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Cloud API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { messages?: { id: string }[] };
    return { providerMessageId: data.messages?.[0]?.id ?? null };
  }

  async downloadMedia(mediaId: string): Promise<{ mimeType: string; base64: string } | null> {
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { authorization: `Bearer ${this.cfg.token}` } });
    if (!meta.ok) return null;
    const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
    const file = await fetch(url, { headers: { authorization: `Bearer ${this.cfg.token}` } });
    if (!file.ok) return null;
    return { mimeType: mime_type.split(";")[0], base64: Buffer.from(await file.arrayBuffer()).toString("base64") };
  }
}

export function verifyCloudSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const given = Buffer.from(header.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

interface CloudWebhook {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: {
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          audio?: { id: string; mime_type?: string };
          button?: { text: string };
          interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
        }[];
        statuses?: { id: string; status: string }[];
      };
    }[];
  }[];
}

export function parseCloudWebhook(payload: unknown): { messages: InboundMessage[]; statuses: { id: string; status: string }[] } {
  const messages: InboundMessage[] = [];
  const statuses: { id: string; status: string }[] = [];
  for (const entry of (payload as CloudWebhook).entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      const names = new Map((v.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? ""]));
      for (const m of v.messages ?? []) {
        const text =
          m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
        messages.push({
          provider: "cloud",
          providerMessageId: m.id,
          phone: normalizePhone("+" + m.from),
          name: names.get(m.from) ?? "",
          text,
          mediaType: m.audio ? (m.audio.mime_type ?? "audio/ogg") : m.type === "text" ? null : m.type,
          mediaRef: m.audio?.id ?? null,
          fromMe: false,
          timestamp: new Date(Number(m.timestamp) * 1000),
        });
      }
      for (const s of v.statuses ?? []) statuses.push({ id: s.id, status: s.status });
    }
  }
  return { messages, statuses };
}
