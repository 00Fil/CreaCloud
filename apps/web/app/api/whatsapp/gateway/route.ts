import { timingSafeEqual } from "node:crypto";

import { after, NextResponse, type NextRequest } from "next/server";

import { processInbound } from "@/lib/agent/process";
import { serviceClient } from "@/lib/db/clients";
import { parseGatewayInbound, type GatewayInbound } from "@/lib/whatsapp/gateway";
import { ingestInbound, updateDeliveryStatus } from "@/lib/whatsapp/ingest";

export const runtime = "nodejs";

type Event =
  | { type: "message"; message: GatewayInbound }
  | { type: "status"; id: string; status: string };

function authorized(req: NextRequest): boolean {
  const token = process.env.WA_GATEWAY_TOKEN;
  const given = req.headers.get("authorization") ?? "";
  if (!token) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(`Bearer ${token}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Eventi inoltrati dal gateway non ufficiale (services/whatsapp-gateway). */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return new NextResponse("unauthorized", { status: 401 });
  const event = (await req.json()) as Event;
  const db = serviceClient();
  if (event.type === "status") {
    await updateDeliveryStatus(db, "baileys", event.id, event.status);
    return NextResponse.json({ ok: true });
  }
  const saved = await ingestInbound(db, parseGatewayInbound(event.message));
  if (saved && !saved.fromMe) after(() => processInbound(saved.chatId, saved.messageId, "baileys"));
  return NextResponse.json({ ok: true, duplicate: !saved });
}
