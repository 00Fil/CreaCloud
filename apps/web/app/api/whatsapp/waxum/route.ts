import { after, NextResponse, type NextRequest } from "next/server";
import { processInbound } from "@/lib/agent/process";
import { serviceClient } from "@/lib/db/clients";
import { ingestInbound, updateDeliveryStatus } from "@/lib/whatsapp/ingest";
import { parseWaxumMessage, parseWaxumReceipts, verifyWaxumSignature, waxumEnvelope } from "@/lib/whatsapp/waxum";

export const runtime = "nodejs";

/** Webhook firmato HMAC v2; la sessione viene verificata prima di accedere al DB. */
export async function POST(req: NextRequest) {
  const secret = process.env.WAXUM_WEBHOOK_SECRET;
  const sessionId = process.env.WAXUM_SESSION_ID;
  if (!secret || !sessionId) return new NextResponse("not configured", { status: 503 });
  const raw = await req.text();
  if (!verifyWaxumSignature(raw, req.headers, secret)) return new NextResponse("bad signature", { status: 401 });
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return new NextResponse("invalid JSON", { status: 400 }); }
  const parsed = waxumEnvelope.safeParse(json);
  if (!parsed.success) return new NextResponse("invalid envelope", { status: 400 });
  const event = parsed.data;
  if (event.session_id !== sessionId) return new NextResponse("wrong session", { status: 403 });
  if (!["message", "receipt"].includes(event.event)) {
    // Non avviare automaticamente connect: non aggirare cooldown e blocchi dell'account.
    return NextResponse.json({ ok: true, ignored: true });
  }
  let message;
  try { message = parseWaxumMessage(event); } catch { return new NextResponse("invalid message", { status: 400 }); }
  const db = serviceClient();
  for (const receipt of parseWaxumReceipts(event)) await updateDeliveryStatus(db, "waxum", receipt.id, receipt.status);
  if (!message) return NextResponse.json({ ok: true, ignored: true });

  if (message.fromMe) {
    const known = await db.from("messages").select("id").eq("provider", "waxum").eq("provider_message_id", message.providerMessageId).maybeSingle();
    if (known.error) throw new Error("Verifica echo fallita");
    if (known.data) return NextResponse.json({ ok: true, duplicate: true });
    // L'echo può precedere la risposta HTTP di invio. Finché l'invio è pendente,
    // chiedi a Waxum di riprovare: non scambiare un invio AI per presa di controllo.
    // Non filtrare per telefono: lo stesso destinatario può apparire come LID
    // nell'echo e come numero nell'invio. L'ID definitivo resta la deduplica.
    const pending = await db.from("messages").select("id").eq("provider", "waxum").eq("direction", "out").eq("status", "in_invio").eq("body", message.text).limit(1);
    if (pending.error) throw new Error("Verifica invio pendente fallita");
    if (pending.data?.length) return new NextResponse("outbound still pending", { status: 503 });
  }
  const saved = await ingestInbound(db, message);
  if (saved && !saved.fromMe) after(() => processInbound(saved.chatId, saved.messageId, "waxum"));
  return NextResponse.json({ ok: true, duplicate: !saved });
}
