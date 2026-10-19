"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { action, ActionError, ok, okRow } from "@/lib/actions/safe";
import { applyAction, audit } from "@/lib/db/actions";
import { loadSettings } from "@/lib/db/repo";
import { classifyCancellation, type LessonStatus } from "@/lib/domain/cancellation";
import { todayRome } from "@/lib/domain/time";
import { cancelLessonSchema, lessonStatusSchema, lockLessonSchema, moveLessonSchema } from "@/lib/schemas/lessons";

function refresh() {
  revalidatePath("/", "layout");
}

/** Cambia lo stato (svolta, programmata, annullata…) di una lezione. */
export const setLessonStatus = action(lessonStatusSchema, async ({ lessonId, status }, { db, staff }) => {
  const clear = status === "programmata" || status === "svolta";
  ok(
    await db
      .from("lessons")
      .update({ status, ...(clear ? { cancelled_at: null, cancelled_by: null, cancellation_reason: null } : {}) })
      .eq("id", lessonId),
    "stato lezione",
  );
  await audit(db, staff.userId, "stato_lezione", "lessons", lessonId, { status });
  refresh();
});

/** Annulla applicando la regola del preavviso; "senza compenso" solo per scelta del centro. */
export const cancelLesson = action(cancelLessonSchema, async ({ lessonId, mode, reason }, { db, staff }) => {
  const lesson = okRow(await db.from("lessons").select("date, start_min, status").eq("id", lessonId).single(), "lettura lezione");
  if (lesson.status !== "programmata") throw new ActionError("La lezione non è più in programma.");
  const settings = await loadSettings(db);
  const status: LessonStatus =
    mode === "senza_compenso"
      ? "annullata_senza_compenso"
      : mode === "in_tempo"
        ? "annullata_in_tempo"
        : classifyCancellation(lesson.date, lesson.start_min, new Date(), settings.cancellationHours);
  try {
    await applyAction(db, { type: "annulla_lezione", lessonId, status, reason, by: "coordinatore" }, staff.userId);
  } catch (e) {
    throw new ActionError(e instanceof Error ? `Annullamento non riuscito: ${e.message}` : "Annullamento non riuscito.");
  }
  refresh();
  return { status };
});

/** Sposta una lezione (data, ora e/o tutor); la lezione resta bloccata per il motore. */
export const moveLesson = action(moveLessonSchema, async ({ lessonId, date, startMin, tutorId }, { db, staff }) => {
  if (date !== null || startMin !== null) {
    try {
      await applyAction(db, { type: "sposta_lezione", lessonId, date, startMin, note: "" }, staff.userId);
    } catch (e) {
      throw new ActionError(e instanceof Error ? `Spostamento non riuscito: ${e.message}` : "Spostamento non riuscito.");
    }
  }
  if (tutorId) {
    ok(await db.from("lessons").update({ tutor_id: tutorId, locked: true }).eq("id", lessonId), "cambio tutor");
    await audit(db, staff.userId, "cambia_tutor", "lessons", lessonId, { tutorId });
  }
  refresh();
});

/** Una lezione bloccata non viene spostata dal motore quando ricalcola il piano. */
export const setLessonLocked = action(lockLessonSchema, async ({ lessonId, locked }, { db }) => {
  ok(await db.from("lessons").update({ locked }).eq("id", lessonId), "blocco lezione");
  refresh();
});

/** Segna come svolte tutte le lezioni programmate già passate (fino a ieri). */
export const markPastDone = action(z.object({}), async (_input, { db, staff }) => {
  const rows = okRow(
    await db.from("lessons").update({ status: "svolta" }).eq("status", "programmata").lt("date", todayRome()).select("id"),
    "lezioni passate",
  );
  await audit(db, staff.userId, "segna_svolte", "lessons", null, { count: rows.length });
  refresh();
  return { count: rows.length };
});
