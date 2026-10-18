/**
 * Canale non ufficiale: il servizio services/whatsapp-gateway (Baileys) tiene
 * il numero del centro collegato come dispositivo, così resta usabile anche
 * dal telefono. Qui parliamo con il gateway via HTTP.
 */

import type { OutboundChannel } from "@/lib/agent/types";

import { normalizePhone, type InboundMessage } from "./types";

export interface GatewayConfig {
  url: string;
  token: string;
}

export function gatewayConfigFromEnv(): GatewayConfig | null {
  const { WA_GATEWAY_URL, WA_GATEWAY_TOKEN } = process.env;
  if (!WA_GATEWAY_URL || !WA_GATEWAY_TOKEN) return null;
  return { url: WA_GATEWAY_URL.replace(/\/$/, ""), token: WA_GATEWAY_TOKEN };
}

export class GatewayChannel implements OutboundChannel {
  readonly provider = "baileys";

  constructor(private readonly cfg: GatewayConfig) {}

  private headers() {
    return { authorization: `Bearer ${this.cfg.token}`, "content-type": "application/json" };
  }

  async send(phone: string, text: string, opts?: { manual?: boolean }) {
    const res = await fetch(`${this.cfg.url}/send`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ to: phone, text, force: Boolean(opts?.manual) }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { id?: string };
    return { providerMessageId: data.id ?? null };
  }

  async downloadMedia(ref: string): Promise<{ mimeType: string; base64: string } | null> {
    const res = await fetch(`${this.cfg.url}/media/${encodeURIComponent(ref)}`, { headers: this.headers() });
    if (!res.ok) return null;
    return (await res.json()) as { mimeType: string; base64: string };
  }

  async status(): Promise<{ state: string; qr: string | null; me: string | null }> {
    try {
      const res = await fetch(`${this.cfg.url}/status`, { headers: this.headers(), signal: AbortSignal.timeout(5_000) });
      if (!res.ok) return { state: "irraggiungibile", qr: null, me: null };
      return (await res.json()) as { state: string; qr: string | null; me: string | null };
    } catch {
      return { state: "irraggiungibile", qr: null, me: null };
    }
  }

  async logout(): Promise<void> {
    await fetch(`${this.cfg.url}/logout`, { method: "POST", headers: this.headers() });
  }
}

/** Formato con cui il gateway inoltra i messaggi. */
export interface GatewayInbound {
  id: string;
  phone: string;
  name?: string;
  text?: string;
  mediaType?: string | null;
  fromMe?: boolean;
  timestamp?: number;
}

export function parseGatewayInbound(p: GatewayInbound): InboundMessage {
  return {
    provider: "baileys",
    providerMessageId: p.id,
    phone: normalizePhone(p.phone),
    name: p.name ?? "",
    text: p.text ?? "",
    mediaType: p.mediaType ?? null,
    mediaRef: p.mediaType ? p.id : null,
    fromMe: Boolean(p.fromMe),
    timestamp: new Date((p.timestamp ?? Date.now() / 1000) * 1000),
  };
}
