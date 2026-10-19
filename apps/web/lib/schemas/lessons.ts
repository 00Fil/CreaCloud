import { z } from "zod";

import { dateStr, minutes, uuid } from "./common";

export const LESSON_STATUSES = ["programmata", "svolta", "annullata_in_tempo", "annullata_tardiva", "annullata_senza_compenso"] as const;

export const lessonStatusSchema = z.object({ lessonId: uuid, status: z.enum(LESSON_STATUSES) });

/**
 * "automatico": applica la regola del preavviso (tardiva = fatturata);
 * "in_tempo": annullata senza addebito; "senza_compenso": eccezione decisa dal centro.
 */
export const cancelLessonSchema = z.object({
  lessonId: uuid,
  mode: z.enum(["automatico", "in_tempo", "senza_compenso"]).default("automatico"),
  reason: z.string().trim().max(500).default(""),
});

export const moveLessonSchema = z
  .object({
    lessonId: uuid,
    date: dateStr.nullable(),
    startMin: minutes.nullable(),
    tutorId: uuid.nullable().optional(),
  })
  .refine((v) => v.date !== null || v.startMin !== null || !!v.tutorId, { message: "Indica nuova data, orario o tutor", path: ["date"] });

export const lockLessonSchema = z.object({ lessonId: uuid, locked: z.boolean() });
