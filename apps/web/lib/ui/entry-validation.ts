import { parseHhmm } from "@/lib/domain/time";
const str = (data: FormData, name: string) =>
  String(data.get(name) ?? "").trim();
export function validateHoursInput(data: FormData): string | null {
  const days = data.getAll("weekday").map(Number);
  if (!days.length || days.some((n) => !Number.isInteger(n) || n < 0 || n > 6))
    return "Seleziona almeno un giorno valido.";
  const start = parseHhmm(str(data, "start")),
    end = parseHhmm(str(data, "end"));
  return start === null || end === null || end <= start
    ? "Indica una fascia oraria valida, con la fine successiva all’inizio."
    : null;
}
export function validateDayInput(data: FormData): string | null {
  if (data.get("all_day") === "on") return null;
  const start = parseHhmm(str(data, "start")),
    end = parseHhmm(str(data, "end"));
  return start === null || end === null || end <= start
    ? "Scegli una giornata intera oppure una fascia oraria completa e valida."
    : null;
}
export function validateModesInput(data: FormData): string | null {
  const modes = data.getAll("modes");
  return !modes.length || modes.some((v) => v !== "presenza" && v !== "online")
    ? "Scegli almeno una modalità di insegnamento valida."
    : null;
}
export function validateRequestInput(data: FormData): string | null {
  if (
    !str(data, "subject_id") ||
    !data.getAll("student_ids").filter(Boolean).length
  )
    return "Indica materia e studente.";
  if (![1, 2, 3, 4, 5].includes(Number(str(data, "sessions_per_week"))))
    return "Scegli da una a cinque lezioni a settimana.";
  if (![60, 90, 120].includes(Number(str(data, "duration_min"))))
    return "Scegli una durata valida.";
  if (!["presenza", "online", "indifferente"].includes(str(data, "mode")))
    return "Scegli la modalità della lezione.";
  if (!["on", "off"].includes(str(data, "flexible_duration")))
    return "Scegli esplicitamente se la durata può essere adattata.";
  return null;
}
export function validatePaymentInput(data: FormData): string | null {
  const raw = str(data, "amount");
  const n = Number(raw.replace(",", "."));
  return !/^\d+([,.]\d{1,2})?$/.test(raw) ||
    !Number.isFinite(n) ||
    Math.round(n * 100) <= 0
    ? "Inserisci un importo maggiore di zero, con massimo due decimali."
    : null;
}
