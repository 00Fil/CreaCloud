/** Esecuzione delle azioni sul database: usata dall'agente e dalle approvazioni del coordinatore. */

import type { Action } from "@/lib/agent/types";
import { datesBetween } from "@/lib/domain/time";

import { must, type Db } from "./util";

export async function audit(db: Db, actor: string, action: string, entity: string, entityId: string | null, details: unknown) {
  await db.from("audit_log").insert({ actor, action, entity, entity_id: entityId, details });
}

export async function applyAction(db: Db, action: Action, actor = "ai"): Promise<void> {
  const source = actor === "ai" ? "ai" : "coordinatore";
  switch (action.type) {
    case "aggiungi_vincolo": {
      const base = {
        student_id: action.studentId,
        priority: action.priority,
        category: action.category,
        label: action.label,
        start_min: action.startMin,
        end_min: action.endMin,
        valid_to: action.validTo,
        source,
        priority_confirmed: source === "coordinatore",
      };
      const rows = action.date
        ? [{ ...base, date: action.date, weekday: null }]
        : action.weekdays.map((weekday) => ({ ...base, weekday, date: null }));
      must(await db.from("student_constraints").insert(rows), "inserimento vincolo");
      break;
    }
    case "rimuovi_vincolo":
      must(await db.from("student_constraints").delete().eq("id", action.constraintId), "rimozione vincolo");
      break;
    case "disponibilita_tutor": {
      if (action.replaceAll) {
        must(await db.from("tutor_availability").delete().eq("tutor_id", action.tutorId), "pulizia disponibilità");
      }
      must(
        await db.from("tutor_availability").insert(
          action.windows.map((w) => ({
            tutor_id: action.tutorId,
            weekday: w.weekday,
            start_min: w.startMin,
            end_min: w.endMin,
            source,
          })),
        ),
        "inserimento disponibilità",
      );
      break;
    }
    case "assenza_tutor":
      must(
        await db.from("tutor_absences").insert(
          datesBetween(action.from, action.to).map((date) => ({
            tutor_id: action.tutorId,
            date,
            start_min: action.startMin,
            end_min: action.endMin,
            note: action.note,
            source,
          })),
        ),
        "inserimento assenza",
      );
      break;
    case "richiesta_lezioni": {
      const req = must(
        await db
          .from("lesson_requests")
          .insert({
            kind: action.single ? "singola" : "ricorrente",
            subject_id: action.subjectId,
            sessions_per_week: action.sessionsPerWeek,
            duration_min: action.durationMin,
            mode: action.mode,
            topic: action.topic,
            window_from: action.windowFrom,
            window_to: action.windowTo,
            source,
          })
          .select("id")
          .single(),
        "inserimento richiesta",
      ) as { id: string };
      must(
        await db.from("lesson_request_students").insert({ request_id: req.id, student_id: action.studentId }),
        "collegamento studente",
      );
      break;
    }
    case "annulla_lezione": {
      const res = must(
        await db
          .from("lessons")
          .update({
            status: action.status,
            cancelled_at: new Date().toISOString(),
            cancelled_by: action.by,
            cancellation_reason: action.reason,
          })
          .eq("id", action.lessonId)
          .eq("status", "programmata")
          .select("id"),
        "annullamento",
      ) as { id: string }[];
      if (!res.length) throw new Error("la lezione non è più in programma");
      break;
    }
    case "sposta_lezione": {
      if (!action.date && action.startMin === null) throw new Error("indicare nuova data o nuovo orario");
      const lesson = must(
        await db.from("lessons").select("date, start_min, end_min").eq("id", action.lessonId).single(),
        "lettura lezione",
      ) as { date: string; start_min: number; end_min: number };
      const start = action.startMin ?? lesson.start_min;
      must(
        await db
          .from("lessons")
          .update({
            date: action.date ?? lesson.date,
            start_min: start,
            end_min: start + (lesson.end_min - lesson.start_min),
            locked: true,
          })
          .eq("id", action.lessonId),
        "spostamento",
      );
      break;
    }
    case "modifica_lezioni": {
      let requestId = action.requestId;
      if (!requestId) {
        const reqs = must(
          await db
            .from("lesson_request_students")
            .select("request_id, lesson_requests!inner(status)")
            .eq("student_id", action.studentId)
            .eq("lesson_requests.status", "attiva"),
          "ricerca richieste",
        ) as { request_id: string }[];
        if (reqs.length !== 1) throw new Error("più richieste attive: scegliere quale modificare");
        requestId = reqs[0].request_id;
      }
      const patch: Record<string, unknown> = {};
      if (action.sessionsPerWeek) patch.sessions_per_week = action.sessionsPerWeek;
      if (action.durationMin) patch.duration_min = action.durationMin;
      if (action.note) patch.notes = action.note;
      must(await db.from("lesson_requests").update(patch).eq("id", requestId), "modifica richiesta");
      break;
    }
  }
  await audit(db, actor, action.type, "azione", null, action);
}
