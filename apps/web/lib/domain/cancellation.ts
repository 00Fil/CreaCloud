import { romeToInstant, type DateStr } from "./time";

export type LessonStatus =
  | "programmata"
  | "svolta"
  | "annullata_in_tempo"
  | "annullata_tardiva"
  | "annullata_senza_compenso";

export const STATUS_LABEL: Record<LessonStatus, string> = {
  programmata: "Programmata",
  svolta: "Svolta",
  annullata_in_tempo: "Annullata in tempo",
  annullata_tardiva: "Annullata tardi (fatturata)",
  annullata_senza_compenso: "Annullata (senza compenso)",
};

/** Ore che mancano all'inizio della lezione (negative se già iniziata). */
export function hoursBefore(date: DateStr, startMin: number, at: Date): number {
  return (romeToInstant(date, startMin).getTime() - at.getTime()) / 3_600_000;
}

/**
 * Regola del centro: annullando almeno `thresholdHours` prima la lezione non
 * si paga; dopo, viene fatturata al genitore e pagata al tutor. Solo il
 * gestore può marcarla "senza compenso" per motivi seri.
 */
export function classifyCancellation(
  date: DateStr,
  startMin: number,
  cancelledAt: Date,
  thresholdHours = 24,
): Extract<LessonStatus, "annullata_in_tempo" | "annullata_tardiva"> {
  return hoursBefore(date, startMin, cancelledAt) >= thresholdHours ? "annullata_in_tempo" : "annullata_tardiva";
}

export function isCancelled(status: LessonStatus): boolean {
  return status.startsWith("annullata");
}
