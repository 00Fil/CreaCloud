"use server";

import { revalidatePath } from "next/cache";

import type { Action } from "@/lib/agent/types";
import { requireStaff } from "@/lib/auth/staff";
import { applyAction } from "@/lib/db/actions";
import { sessionClient } from "@/lib/db/clients";
import { parseHhmm } from "@/lib/domain/time";
import { sendToChat } from "@/lib/chat/send";

const ACTION_KINDS = new Set([
  "aggiungi_vincolo",
  "rimuovi_vincolo",
  "disponibilita_tutor",
  "assenza_tutor",
  "richiesta_lezioni",
  "annulla_lezione",
  "sposta_lezione",
  "modifica_lezioni",
]);

export async function decidePendingAction(formData: FormData) {
  const staff = await requireStaff();
  const db = await sessionClient();
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision"));
  const notify = String(formData.get("notify") ?? "").trim();

  const { data: pa } = await db.from("pending_actions").select("*").eq("id", id).single();
  if (!pa || pa.status !== "in_attesa") return;

  let status = "rifiutata";
  let error: string | null = null;
  try {
    if (decision === "approva" && ACTION_KINDS.has(pa.kind)) {
      const action = { ...(pa.payload as Action) } as Action;
      if (action.type === "sposta_lezione") {
        const date = String(formData.get("date") ?? "");
        const time = parseHhmm(String(formData.get("time") ?? ""));
        if (date) action.date = date;
        if (time !== null) action.startMin = time;
      }
      await applyAction(db, action, staff.userId);
      status = "applicata";
    } else if (decision === "senza_compenso" && (pa.payload as Action).type === "annulla_lezione") {
      const lessonId = (pa.payload as Extract<Action, { type: "annulla_lezione" }>).lessonId;
      const res = await db.from("lessons").update({ status: "annullata_senza_compenso" }).eq("id", lessonId);
      if (res.error) throw new Error(res.error.message);
      status = "applicata";
    } else if (decision === "fatto") {
      status = "applicata";
    }
  } catch (e) {
    status = "errore";
    error = String(e).slice(0, 300);
  }
  await db
    .from("pending_actions")
    .update({ status, decided_by: staff.userId, decided_at: new Date().toISOString(), reason: error ? `${pa.reason} — ${error}` : pa.reason })
    .eq("id", id);
  if (notify && pa.chat_id && status === "applicata") {
    await sendToChat(pa.chat_id, notify, "coordinatore").catch(() => undefined);
  }
  revalidatePath("/");
}
