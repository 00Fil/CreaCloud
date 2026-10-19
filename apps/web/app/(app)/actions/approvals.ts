"use server";

import { revalidatePath } from "next/cache";

import type { Action } from "@/lib/agent/types";
import { action, ActionError, ok, okRow } from "@/lib/actions/safe";
import { sendToChat } from "@/lib/chat/send";
import { applyAction } from "@/lib/db/actions";
import { decisionSchema } from "@/lib/schemas/approvals";

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

/**
 * Decide su un'azione proposta dall'assistente. Restituisce lo stato finale
 * e se il messaggio di avviso è stato mandato.
 */
export const decidePendingAction = action(decisionSchema, async (input, { db, staff }) => {
  const pa = okRow(await db.from("pending_actions").select("*").eq("id", input.id).single(), "lettura proposta");
  if (pa.status !== "in_attesa") throw new ActionError("Questa proposta è già stata decisa.");
  const payload = pa.payload as unknown as Action;

  let status: "applicata" | "rifiutata" | "errore" = "rifiutata";
  let error: string | null = null;
  try {
    if (input.decision === "approva") {
      if (!ACTION_KINDS.has(pa.kind)) throw new Error("tipo di proposta non applicabile automaticamente");
      const act = { ...payload } as Action;
      if (act.type === "sposta_lezione") {
        if (input.date) act.date = input.date;
        if (input.startMin != null) act.startMin = input.startMin;
      }
      await applyAction(db, act, staff.userId);
      status = "applicata";
    } else if (input.decision === "senza_compenso") {
      if (payload.type !== "annulla_lezione") throw new Error("solo per gli annullamenti");
      ok(await db.from("lessons").update({ status: "annullata_senza_compenso" }).eq("id", payload.lessonId), "annullamento senza compenso");
      status = "applicata";
    } else if (input.decision === "fatto") {
      status = "applicata";
    }
  } catch (e) {
    status = "errore";
    error = (e instanceof Error ? e.message : String(e)).slice(0, 300);
  }
  ok(
    await db
      .from("pending_actions")
      .update({
        status,
        decided_by: staff.userId,
        decided_at: new Date().toISOString(),
        reason: error ? `${pa.reason} — ${error}` : pa.reason,
      })
      .eq("id", input.id),
    "salvataggio decisione",
  );
  let notified = false;
  if (input.notify && pa.chat_id && status === "applicata") {
    notified = await sendToChat(pa.chat_id, input.notify, "coordinatore").then(
      () => true,
      () => false,
    );
  }
  revalidatePath("/", "layout");
  if (status === "errore") throw new ActionError(`Non è stato possibile applicarla: ${error}`);
  return { status, notified };
});
