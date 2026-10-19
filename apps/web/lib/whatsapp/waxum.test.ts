import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseWaxumMessage, parseWaxumReceipts, recipientJid, verifyWaxumSignature, WaxumChannel, WaxumError, humanDelayMs, waxumConfigFromEnv, type WaxumEnvelope } from "./waxum";

const cfg = { paceSends: false, url: "http://waxum:3451", token: "test-token", sessionId: "centro/1", webhookUrl: "https://example.org/api/whatsapp/waxum", webhookSecret: "secret" };
const event = (data: Record<string, unknown> = {}): WaxumEnvelope => ({
  session_id: cfg.sessionId, event: "message", timestamp: 1792348800,
  data: { message_id: "msg-1", from: "393331234567@s.whatsapp.net", chat: "393331234567@s.whatsapp.net", is_from_me: false, message_type: "text", text: "Ciao", ...data },
});
const media = { kind: "audio", direct_path: "/v/t62/test", media_key: "YWJj", file_sha256: "ZA==", file_enc_sha256: "ZQ==", file_length: 12, mimetype: "audio/ogg; codecs=opus" };
function response(body: unknown, status = 200, headers?: HeadersInit) { return new Response(JSON.stringify(body), { status, headers }); }
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("firma Waxum v2", () => {
  const now = 1792348800000;
  function headers(raw: string, timestamp = String(now / 1000)) {
    return new Headers({ "x-webhook-signature-version": "v2", "x-webhook-timestamp": timestamp, "x-webhook-signature": `sha256=${createHmac("sha256", "secret").update(`${timestamp}.${raw}`).digest("hex")}` });
  }
  it("verifica il corpo grezzo", () => expect(verifyWaxumSignature('{ "a": 1 }', headers('{ "a": 1 }'), "secret", now)).toBe(true));
  it("rifiuta corpo modificato", () => expect(verifyWaxumSignature('{"a":1}', headers('{ "a": 1 }'), "secret", now)).toBe(false));
  it("rifiuta segreto errato", () => expect(verifyWaxumSignature("{}", headers("{}"), "bad", now)).toBe(false));
  it.each([-301, 301])("rifiuta timestamp fuori finestra %s", (delta) => expect(verifyWaxumSignature("{}", headers("{}", String(now / 1000 + delta)), "secret", now)).toBe(false));
  it("accetta il limite di 300 secondi", () => expect(verifyWaxumSignature("{}", headers("{}", String(now / 1000 - 300)), "secret", now)).toBe(true));
  it("rifiuta downgrade v1", () => { const h = headers("{}"); h.delete("x-webhook-signature-version"); expect(verifyWaxumSignature("{}", h, "secret", now)).toBe(false); });
  it.each(["", "abc", "sha256=zz", "sha256=" + "a".repeat(63)])("rifiuta firma malformata %s", (s) => { const h = headers("{}"); h.set("x-webhook-signature", s); expect(verifyWaxumSignature("{}", h, "secret", now)).toBe(false); });
  it("rifiuta timestamp non numerico", () => { const h = headers("{}"); h.set("x-webhook-timestamp", "NaN"); expect(verifyWaxumSignature("{}", h, "secret", now)).toBe(false); });
});

describe("normalizzazione webhook", () => {
  it("normalizza un messaggio diretto", () => expect(parseWaxumMessage(event())).toMatchObject({ provider: "waxum", phone: "+393331234567", text: "Ciao", fromMe: false }));
  it("usa from_phone per LID risolto", () => expect(parseWaxumMessage(event({ from: "123@lid", chat: "123@lid", from_phone: "393331234567" }))?.phone).toBe("+393331234567"));
  it("mantiene LID se il numero non è noto", () => expect(parseWaxumMessage(event({ from: "123@lid", chat: "123@lid", from_phone: null }))?.phone).toBe("lid:123"));
  it("usa chat_phone per messaggi dal telefono", () => expect(parseWaxumMessage(event({ is_from_me: true, from: "393339999999@s.whatsapp.net", from_phone: "393339999999", chat: "123@lid", chat_phone: "393331234567" }))).toMatchObject({ phone: "+393331234567", name: "", fromMe: true }));
  it("non associa gli echo al proprio numero se manca chat", () => expect(parseWaxumMessage(event({ is_from_me: true, chat: null }))).toBeNull());
  it.each(["123@g.us", "status@broadcast", "123@newsletter"])("ignora chat %s", chat => expect(parseWaxumMessage(event({ chat }))).toBeNull());
  it("ignora gruppi dichiarati", () => expect(parseWaxumMessage(event({ is_group: true }))).toBeNull());
  it.each([true, false])("non filtra offline=%s", offline => expect(parseWaxumMessage({ ...event(), offline })?.text).toBe("Ciao"));
  it("salva metadati persistenti del vocale", () => {
    const msg = parseWaxumMessage(event({ message_type: "audio", text: null, media_mimetype: "audio/ogg; codecs=opus", media }));
    expect(msg?.mediaType).toBe("audio/ogg");
    expect(JSON.parse(msg!.mediaRef!)).toMatchObject({ version: 1, sessionId: cfg.sessionId, media });
  });
  it("conserva la didascalia", () => expect(parseWaxumMessage(event({ text: null, caption: "Foto" }))?.text).toBe("Foto"));
  it("normalizza risposta interattiva", () => expect(parseWaxumMessage(event({ text: null, message_type: "interactive_response", selected_text: "Confermo" }))?.text).toBe("Confermo"));
  it("mantiene il timestamp originario nei replay", () => expect(parseWaxumMessage(event({ timestamp: "2026-10-18T10:00:00Z" }))?.timestamp.toISOString()).toBe("2026-10-18T10:00:00.000Z"));
  it("rifiuta timestamp invalido", () => expect(() => parseWaxumMessage(event({ timestamp: "invalid" }))).toThrow());
  it("rifiuta messaggi senza ID", () => expect(() => parseWaxumMessage(event({ message_id: "" }))).toThrow());
  it("non inventa ricevute dal debug Rust", () => expect(parseWaxumReceipts({ ...event(), event: "receipt", data: { receipt: "Receipt { .. }" } })).toEqual([]));
  it("gestisce ricevute strutturate", () => expect(parseWaxumReceipts({ ...event(), event: "receipt", data: { message_id: "m", status: "read" } })).toEqual([{ id: "m", status: "read" }]));
});

describe("destinatari e configurazione", () => {
  it.each([["+393331234567", "393331234567"], ["3331234567", "393331234567"], ["lid:123", "123@lid"], ["123@lid", "123@lid"]])("converte %s", (a, b) => expect(recipientJid(a)).toBe(b));
  it.each(["", "hello", "status@broadcast"])("rifiuta %s", a => expect(() => recipientJid(a)).toThrow());
  it("legge e normalizza URL API", () => { vi.stubEnv("WAXUM_URL", "https://example.org/api/v1/"); vi.stubEnv("WAXUM_TOKEN", "t"); vi.stubEnv("WAXUM_SESSION_ID", "s"); expect(waxumConfigFromEnv()?.url).toBe("https://example.org"); });
});

describe("client HTTP Waxum", () => {
  it("invia testo con Bearer e session ID escapato", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ message_id: "m1" })); vi.stubGlobal("fetch", fetcher);
    expect(await new WaxumChannel(cfg).send("+393331234567", "Test", { manual: true })).toEqual({ providerMessageId: "m1" });
    const [url, opts] = fetcher.mock.calls[0];
    expect(url).toBe("http://waxum:3451/api/v1/sessions/centro%2F1/messages/text");
    expect(opts.headers.authorization).toBe("Bearer test-token"); expect(JSON.parse(opts.body)).toEqual({ to: "393331234567", text: "Test" });
    expect(opts.redirect).toBe("error");
  });
  it("blocca primo contatto AI prima della rete", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    await expect(new WaxumChannel(cfg).send("+393331234567", "Test")).rejects.toThrow("primo contatto"); expect(f).not.toHaveBeenCalled();
  });
  it("consente una risposta AI a una chat già ricevuta", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ message_id: "m" }))); await expect(new WaxumChannel(cfg).send("+393331234567", "Test", { lastInboundAt: new Date().toISOString() })).resolves.toEqual({ providerMessageId: "m" }); });
  it("rispetta opt-in esplicito primo contatto", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ message_id: "m" }))); await expect(new WaxumChannel({ ...cfg, allowFirstContact: true }).send("+393331234567", "Test")).resolves.toBeDefined(); });
  it("non ritenta invii 429 e conserva Retry-After", async () => {
    const f = vi.fn().mockResolvedValue(response({}, 429, { "retry-after": "120" })); vi.stubGlobal("fetch", f);
    await expect(new WaxumChannel(cfg).send("+393331234567", "Test", { manual: true })).rejects.toMatchObject({ status: 429, retryAfter: "120" }); expect(f).toHaveBeenCalledTimes(1);
  });
  it("non ritenta timeout di invio ambiguo", async () => {
    const f = vi.fn().mockRejectedValue(new Error("timeout")); vi.stubGlobal("fetch", f);
    await expect(new WaxumChannel(cfg).send("+393331234567", "Test", { manual: true })).rejects.toThrow("timeout"); expect(f).toHaveBeenCalledTimes(1);
  });
  it("scarica il vocale usando i metadati, non il message ID", async () => {
    const f = vi.fn().mockResolvedValue(response({ data: "YXVkaW8=", size: 5 })); vi.stubGlobal("fetch", f);
    const msg = parseWaxumMessage(event({ media, media_mimetype: "audio/ogg" }))!;
    expect(await new WaxumChannel(cfg).downloadMedia(msg.mediaRef!)).toEqual({ mimeType: "audio/ogg", base64: "YXVkaW8=" });
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({ media_type: "audio", direct_path: media.direct_path });
  });
  it("rifiuta media di altre sessioni e riferimenti legacy", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f); const ch = new WaxumChannel(cfg);
    expect(await ch.downloadMedia("legacy-id")).toBeNull();
    expect(await ch.downloadMedia(JSON.stringify({ version: 1, sessionId: "other", mimeType: "audio/ogg", media }))).toBeNull(); expect(f).not.toHaveBeenCalled();
  });
  it("rileva il socket morto anche con login salvato", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ status: "logged_in", is_logged_in: true, socket_alive: false }))); expect((await new WaxumChannel(cfg).status()).state).toBe("socket_offline"); });
  it("genera QR localmente senza servizi esterni", async () => {
    const f = vi.fn().mockResolvedValueOnce(response({ status: "waiting_for_qr", is_logged_in: false })).mockResolvedValueOnce(response({ qr_codes: ["2@TEST"] })); vi.stubGlobal("fetch", f);
    expect((await new WaxumChannel(cfg).status()).qr).toMatch(/^data:image\/png;base64,/);
  });
  it.each([[404, "missing"], [401, "unauthorized"], [403, "unauthorized"], [500, "unreachable"]])("status HTTP %s", async (code, state) => { const f = vi.fn().mockResolvedValue(response({}, code)); vi.stubGlobal("fetch", f); expect((await new WaxumChannel(cfg).status()).state).toBe(state); expect(f).toHaveBeenCalledTimes(1); });
  it("crea la sessione, registra webhook e connette", async () => {
    const f = vi.fn().mockResolvedValueOnce(response({}, 404)).mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({ webhooks: [] })).mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({})); vi.stubGlobal("fetch", f);
    await new WaxumChannel(cfg).connect();
    expect(f.mock.calls.map(c => [c[0].split("/api/v1")[1], c[1].method])).toEqual([["/sessions/centro%2F1", "GET"], ["/sessions", "POST"], ["/sessions/centro%2F1/webhooks", "GET"], ["/sessions/centro%2F1/webhooks", "POST"], ["/sessions/centro%2F1/connect", "POST"]]);
    expect(JSON.parse(f.mock.calls[3][1].body).secret).toBe("secret");
  });
  it("ricollega senza duplicare webhook esistenti", async () => {
    const f = vi.fn().mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({ webhooks: [{ id: "h", url: cfg.webhookUrl, secret: "secret", events: ["all"], enabled: true }] })).mockImplementation(() => Promise.resolve(response({}))); vi.stubGlobal("fetch", f);
    await new WaxumChannel(cfg).connect(); expect(f.mock.calls[2][0]).toContain("/webhooks/h/enable"); expect(f).toHaveBeenCalledTimes(4);
  });
  it("ruota il segreto rimuovendo prima il webhook solo dello stesso URL", async () => {
    const f = vi.fn().mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({ webhooks: [{ id: "old", url: cfg.webhookUrl, secret: "old", events: ["all"], enabled: true }, { id: "other", url: "https://other.org", events: ["all"] }] })).mockImplementation(() => Promise.resolve(response({}))); vi.stubGlobal("fetch", f);
    await new WaxumChannel(cfg).connect(); expect(f.mock.calls[2][1].method).toBe("DELETE"); expect(f.mock.calls[3][1].method).toBe("POST"); expect(f.mock.calls.some(c => c[0].endsWith("/other"))).toBe(false);
  });
  it("logout non elimina la sessione", async () => { const f = vi.fn().mockImplementation(() => Promise.resolve(response({}))); vi.stubGlobal("fetch", f); await new WaxumChannel(cfg).logout(); expect(f.mock.calls[0][0]).toContain("/logout"); expect(f.mock.calls[0][1].method).toBe("POST"); });
  it("non sopprime errori logout", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({}, 503))); await expect(new WaxumChannel(cfg).logout()).rejects.toBeInstanceOf(WaxumError); });
});

describe("ritmo di invio", () => {
  it("mantiene il ritardo del gateway precedente", () => {
    expect(humanDelayMs("Ciao", () => 0)).toBe(700);
    expect(humanDelayMs("x".repeat(1000), () => 1)).toBe(5500);
  });
  it("invia presenza e digitazione con un JID completo", async () => {
    vi.useFakeTimers();
    const f = vi.fn().mockImplementation(() => Promise.resolve(response({ message_id: "m" })));
    vi.stubGlobal("fetch", f);
    try {
      const pending = new WaxumChannel({ ...cfg, paceSends: true }).send("+393331234567", "Ciao", { manual: true });
      await vi.runAllTimersAsync();
      await pending;
      expect(f.mock.calls.map(c => c[0].split("/centro%2F1")[1])).toEqual(["/presence/subscribe", "/chatstate/send", "/chatstate/send", "/messages/text"]);
      expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ to: "393331234567@s.whatsapp.net", state: "composing" });
      expect(JSON.parse(f.mock.calls[2][1].body).state).toBe("paused");
    } finally { vi.useRealTimers(); }
  });
  it("ignora le reazioni senza attivare AI", () => expect(parseWaxumMessage(event({ message_type: "reaction", text: "👍" }))).toBeNull());
});
