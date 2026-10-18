/**
 * Gateway WhatsApp non ufficiale (Baileys). Collega il numero del centro come
 * "dispositivo collegato": il telefono continua a funzionare normalmente.
 *
 * Inoltra i messaggi alla piattaforma (WEB_INBOUND_URL) e invia le risposte
 * con ritmo umano. Per ridurre il rischio di blocco del numero:
 * - nessun invio a chi non ha mai scritto (salvo ALLOW_FIRST_CONTACT=true);
 * - un messaggio alla volta, con "sta scrivendo…" e pause casuali;
 * - nessun invio massivo.
 */

import { randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";

import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from "baileys";
import pino from "pino";
import QRCode from "qrcode";

import { extractContent, humanDelayMs, jidFromPhone, phoneFromKey } from "./jid.js";

const PORT = Number(process.env.PORT ?? 3001);
const TOKEN = process.env.WA_GATEWAY_TOKEN ?? "";
const INBOUND_URL = process.env.WEB_INBOUND_URL ?? "";
const AUTH_DIR = process.env.AUTH_DIR ?? "./auth";
const ALLOW_FIRST_CONTACT = process.env.ALLOW_FIRST_CONTACT === "true";
const MEDIA_TTL_MS = 24 * 3_600_000;

if (!TOKEN || !INBOUND_URL) {
  console.error("WA_GATEWAY_TOKEN e WEB_INBOUND_URL sono obbligatori");
  process.exit(1);
}
mkdirSync(AUTH_DIR, { recursive: true });

const logger = pino({ level: process.env.LOG_LEVEL ?? "warn" });

// ------------------------------------------------------------------ stato

let sock: WASocket | null = null;
let state: "avvio" | "da_collegare" | "connesso" | "disconnesso" = "avvio";
let qrDataUrl: string | null = null;
let me: string | null = null;

const sentByUs = new Set<string>();
const media = new Map<string, { mimeType: string; base64: string; at: number }>();
const knownFile = join(AUTH_DIR, "known-contacts.json");
const known = new Set<string>(existsSync(knownFile) ? (JSON.parse(readFileSync(knownFile, "utf8")) as string[]) : []);

function remember(phone: string) {
  if (known.has(phone)) return;
  known.add(phone);
  writeFileSync(knownFile, JSON.stringify([...known]));
}

// ------------------------------------------------------------------ inoltro

const outbox: object[] = [];
let flushing = false;

async function forward(event: object) {
  outbox.push(event);
  if (flushing) return;
  flushing = true;
  while (outbox.length) {
    try {
      const res = await fetch(INBOUND_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify(outbox[0]),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok && res.status < 500) logger.error({ status: res.status }, "evento rifiutato");
      if (res.ok || res.status < 500) outbox.shift();
      else await new Promise((r) => setTimeout(r, 3000));
    } catch (e) {
      logger.warn({ err: String(e) }, "piattaforma irraggiungibile, riprovo");
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  flushing = false;
}

// ------------------------------------------------------------------ connessione

async function connect() {
  const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    auth,
    version,
    logger,
    browser: Browsers.appropriate("Creattivamente"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (u) => {
    if (u.qr) {
      state = "da_collegare";
      qrDataUrl = await QRCode.toDataURL(u.qr);
    }
    if (u.connection === "open") {
      state = "connesso";
      qrDataUrl = null;
      me = sock?.user?.id ? "+" + sock.user.id.split(":")[0].split("@")[0] : null;
      logger.warn({ me }, "connesso");
    }
    if (u.connection === "close") {
      const code = (u.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
      state = "disconnesso";
      if (code === DisconnectReason.loggedOut) {
        rmSync(AUTH_DIR, { recursive: true, force: true });
        mkdirSync(AUTH_DIR, { recursive: true });
      }
      setTimeout(() => void connect(), code === DisconnectReason.loggedOut ? 1000 : 5000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" && type !== "append") return;
    for (const m of messages) {
      const id = m.key.id;
      if (!id || !m.message) continue;
      const phone = phoneFromKey(m.key);
      if (!phone) continue;
      const fromMe = Boolean(m.key.fromMe);
      if (fromMe && sentByUs.has(id)) continue;
      if (type === "append" && !fromMe) continue;
      const { text, mediaType } = extractContent(m.message);
      if (mediaType === "ignore") continue;
      if (!fromMe) remember(phone);
      if (mediaType?.startsWith("audio")) {
        try {
          const buf = await downloadMediaMessage(m, "buffer", {});
          media.set(id, { mimeType: mediaType, base64: buf.toString("base64"), at: Date.now() });
        } catch (e) {
          logger.warn({ err: String(e) }, "download vocale non riuscito");
        }
      }
      await forward({
        type: "message",
        message: {
          id,
          phone,
          name: m.pushName ?? "",
          text,
          mediaType,
          fromMe,
          timestamp: Number(m.messageTimestamp ?? Date.now() / 1000),
        },
      });
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    for (const u of updates) {
      const s = u.update.status;
      if (!u.key.id || !u.key.fromMe || s === undefined || s === null) continue;
      const status = s >= 4 ? "read" : s === 3 ? "delivered" : s === 2 ? "sent" : null;
      if (status) await forward({ type: "status", id: u.key.id, status });
    }
  });
}

// ------------------------------------------------------------------ invio

let sendChain: Promise<unknown> = Promise.resolve();

function send(to: string, text: string): Promise<string> {
  const run = async () => {
    if (!sock || state !== "connesso") throw new Error("WhatsApp non connesso");
    const jid = jidFromPhone(to);
    await sock.presenceSubscribe(jid).catch(() => undefined);
    await sock.sendPresenceUpdate("composing", jid).catch(() => undefined);
    await new Promise((r) => setTimeout(r, humanDelayMs(text)));
    await sock.sendPresenceUpdate("paused", jid).catch(() => undefined);
    const res = await sock.sendMessage(jid, { text });
    const id = res?.key.id ?? randomUUID();
    sentByUs.add(id);
    if (sentByUs.size > 5000) sentByUs.delete(sentByUs.values().next().value as string);
    return id;
  };
  const p = sendChain.then(run, run);
  sendChain = p.catch(() => undefined);
  return p;
}

// ------------------------------------------------------------------ HTTP

function authorized(req: IncomingMessage): boolean {
  const a = Buffer.from(req.headers.authorization ?? "");
  const b = Buffer.from(`Bearer ${TOKEN}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function body(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

createServer(async (req, res) => {
  try {
    if (req.url === "/health") return json(res, 200, { ok: true });
    if (!authorized(req)) return json(res, 401, { error: "non autorizzato" });
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/status") {
      return json(res, 200, { state, qr: qrDataUrl, me });
    }
    if (req.method === "POST" && url.pathname === "/send") {
      const { to, text, force } = await body(req);
      if (typeof to !== "string" || typeof text !== "string" || !text.trim()) return json(res, 400, { error: "to e text richiesti" });
      // `force`: invio manuale del coordinatore, mai usato dall'agente
      if (!ALLOW_FIRST_CONTACT && !force && !known.has(to)) {
        return json(res, 409, { error: "il contatto non ha mai scritto al centro: primo contatto non consentito su questo canale" });
      }
      return json(res, 200, { id: await send(to, text) });
    }
    if (req.method === "GET" && url.pathname.startsWith("/media/")) {
      const item = media.get(decodeURIComponent(url.pathname.slice(7)));
      if (!item) return json(res, 404, { error: "non disponibile" });
      return json(res, 200, { mimeType: item.mimeType, base64: item.base64 });
    }
    if (req.method === "POST" && url.pathname === "/logout") {
      await sock?.logout().catch(() => undefined);
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: "non trovato" });
  } catch (e) {
    return json(res, 500, { error: String(e) });
  }
}).listen(PORT, () => logger.warn({ port: PORT }, "gateway in ascolto"));

setInterval(() => {
  const now = Date.now();
  for (const [id, m] of media) if (now - m.at > MEDIA_TTL_MS) media.delete(id);
}, 3_600_000);

void connect();
