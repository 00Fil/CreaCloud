import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ after: vi.fn(), process: vi.fn(), db: vi.fn(), ingest: vi.fn(), delivery: vi.fn() }));
vi.mock("next/server", async () => ({ ...await vi.importActual<typeof import("next/server")>("next/server"), after: mocks.after }));
vi.mock("@/lib/agent/process", () => ({ processInbound: mocks.process }));
vi.mock("@/lib/db/clients", () => ({ serviceClient: mocks.db }));
vi.mock("@/lib/whatsapp/ingest", () => ({ ingestInbound: mocks.ingest, updateDeliveryStatus: mocks.delivery }));
import { POST } from "./route";
const payload = { session_id: "centro", event: "message", timestamp: Math.floor(Date.now() / 1000), data: { message_id: "m1", from: "393331234567@s.whatsapp.net", chat: "393331234567@s.whatsapp.net", is_from_me: false, message_type: "text", text: "Ciao" } };
function request(body: unknown = payload, valid = true) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  return new NextRequest("https://example.org/api/whatsapp/waxum", { method: "POST", body: raw, headers: {
    "x-webhook-timestamp": ts, "x-webhook-signature-version": "v2", "x-webhook-signature": `sha256=${createHmac("sha256", valid ? "secret" : "wrong").update(`${ts}.${raw}`).digest("hex")}`,
  } });
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("WAXUM_WEBHOOK_SECRET", "secret"); vi.stubEnv("WAXUM_SESSION_ID", "centro"); mocks.ingest.mockResolvedValue({ chatId: "c", messageId: "m", fromMe: false }); });
afterEach(() => vi.unstubAllEnvs());
describe("route webhook Waxum", () => {
  it("rifiuta firma errata prima del DB", async () => { expect((await POST(request(payload, false))).status).toBe(401); expect(mocks.db).not.toHaveBeenCalled(); });
  it("rifiuta una sessione diversa prima del DB", async () => { expect((await POST(request({ ...payload, session_id: "other" }))).status).toBe(403); expect(mocks.db).not.toHaveBeenCalled(); });
  it("rifiuta JSON invalido con firma valida", async () => { expect((await POST(request("{"))).status).toBe(400); });
  it("rifiuta envelope malformato", async () => { expect((await POST(request({}))).status).toBe(400); });
  it("rifiuta messaggio senza ID", async () => { expect((await POST(request({ ...payload, data: { ...payload.data, message_id: "" } }))).status).toBe(400); });
  it("richiede configurazione del webhook", async () => { vi.stubEnv("WAXUM_WEBHOOK_SECRET", ""); expect((await POST(request())).status).toBe(503); });
  it("registra messaggio e avvia elaborazione dopo la risposta", async () => { expect((await POST(request())).status).toBe(200); expect(mocks.ingest).toHaveBeenCalledOnce(); expect(mocks.after).toHaveBeenCalledOnce(); await mocks.after.mock.calls[0][0](); expect(mocks.process).toHaveBeenCalledWith("c", "m", "waxum"); });
  it("non rilancia AI per duplicati", async () => { mocks.ingest.mockResolvedValueOnce(null); expect((await POST(request())).status).toBe(200); expect(mocks.after).not.toHaveBeenCalled(); });
  it("ignora eventi di connessione senza DB né AI", async () => { expect((await POST(request({ ...payload, event: "connected", data: {} }))).status).toBe(200); expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.after).not.toHaveBeenCalled(); });
  it("non avvia AI sui gruppi", async () => { await POST(request({ ...payload, data: { ...payload.data, chat: "123@g.us", is_group: true } })); expect(mocks.ingest).not.toHaveBeenCalled(); expect(mocks.after).not.toHaveBeenCalled(); });
  it("aggiorna ricevute strutturate", async () => { await POST(request({ ...payload, event: "receipt", data: { message_id: "m", status: "read" } })); expect(mocks.delivery).toHaveBeenCalledWith(undefined, "waxum", "m", "read"); expect(mocks.ingest).not.toHaveBeenCalled(); });
  it("non scambia un echo già registrato per presa di controllo", async () => {
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "outbound" }, error: null }) };
    mocks.db.mockReturnValueOnce({ from: () => chain });
    await POST(request({ ...payload, data: { ...payload.data, is_from_me: true } })); expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("chiede retry se l'echo arriva durante invio HTTP", async () => {
    const message = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), limit: vi.fn().mockResolvedValue({ data: [{ id: "pending" }], error: null }) };
    const chat = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "c" }, error: null }) };
    mocks.db.mockReturnValueOnce({ from: (table: string) => table === "chats" ? chat : message });
    expect((await POST(request({ ...payload, data: { ...payload.data, is_from_me: true } }))).status).toBe(503); expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("registra un messaggio del telefono senza avviare AI", async () => {
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), limit: vi.fn().mockResolvedValue({ data: [], error: null }) };
    mocks.db.mockReturnValueOnce({ from: () => chain }); mocks.ingest.mockResolvedValueOnce({ chatId: "c", messageId: "m", fromMe: true });
    await POST(request({ ...payload, data: { ...payload.data, is_from_me: true } })); expect(mocks.ingest).toHaveBeenCalledOnce(); expect(mocks.after).not.toHaveBeenCalled();
  });
});
