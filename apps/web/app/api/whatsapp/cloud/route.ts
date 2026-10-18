import { after, NextResponse, type NextRequest } from "next/server";

import { processInbound } from "@/lib/agent/process";
import { serviceClient } from "@/lib/db/clients";
import { cloudConfigFromEnv, parseCloudWebhook, verifyCloudSignature } from "@/lib/whatsapp/cloud";
import { ingestInbound, updateDeliveryStatus } from "@/lib/whatsapp/ingest";

export const runtime = "nodejs";

/** Verifica del webhook da parte di Meta. */
export async function GET(req: NextRequest) {
  const cfg = cloudConfigFromEnv();
  const p = req.nextUrl.searchParams;
  if (cfg && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === cfg.verifyToken) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const cfg = cloudConfigFromEnv();
  if (!cfg) return new NextResponse("not configured", { status: 503 });
  const raw = await req.text();
  if (!verifyCloudSignature(raw, req.headers.get("x-hub-signature-256"), cfg.appSecret)) {
    return new NextResponse("bad signature", { status: 401 });
  }
  const db = serviceClient();
  const { messages, statuses } = parseCloudWebhook(JSON.parse(raw));
  for (const s of statuses) await updateDeliveryStatus(db, "cloud", s.id, s.status);
  for (const m of messages) {
    const saved = await ingestInbound(db, m);
    if (saved && !saved.fromMe) after(() => processInbound(saved.chatId, saved.messageId, "cloud"));
  }
  return NextResponse.json({ ok: true });
}
