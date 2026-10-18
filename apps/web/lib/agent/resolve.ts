import { addDays, nextWeekday, parseHhmm, weekdayOf, type DateStr } from "@/lib/domain/time";

import type { DateRef } from "./schema";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Converte un riferimento di data del modello in una data concreta, o null se non plausibile. */
export function resolveDate(ref: DateRef | null | undefined, today: DateStr): DateStr | null {
  if (!ref) return null;
  let out: DateStr | null = null;
  switch (ref.tipo) {
    case "data":
      if (ref.data && ISO.test(ref.data)) out = ref.data;
      break;
    case "tra_giorni":
      if (ref.giorni !== null && ref.giorni >= 0 && ref.giorni <= 120) out = addDays(today, ref.giorni);
      break;
    case "giorno_settimana": {
      if (ref.giorno_settimana === null) break;
      if (ref.settimana_prossima) {
        const nextMonday = addDays(today, 7 - weekdayOf(today));
        out = addDays(nextMonday, ref.giorno_settimana);
      } else {
        out = nextWeekday(today, ref.giorno_settimana);
      }
      break;
    }
  }
  if (!out) return null;
  // fuori da una finestra ragionevole è quasi certamente un errore
  if (out < addDays(today, -7) || out > addDays(today, 240)) return null;
  return out;
}

export function resolveTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = parseHhmm(value);
  return m === null ? null : m;
}

/** Normalizza la durata richiesta sulle durate del centro (60/90/120). */
export function normalizeDuration(minutes: number | null | undefined): number | null {
  if (!minutes) return null;
  if (minutes <= 75) return 60;
  if (minutes <= 105) return 90;
  return 120;
}

const YES_WORDS = "s[iì]+|ok+|okay|va bene|confermo|conferma|certo|perfetto|esatto|giusto|d'accordo|yes|👍";
const NO_WORDS = "no+|annulla|non va bene|non confermo|sbagliato|❌";
const TAIL = "(?:[\\s,!.]+(?:grazie|grazie mille|perfetto|ok|certo|si|sì|👍|🙏|😊))*[\\s!.]*";
const YES = new RegExp(`^(?:${YES_WORDS})(?:[\\s,]+(?:${YES_WORDS}))*${TAIL}$`, "iu");
const NO = new RegExp(`^(?:${NO_WORDS})(?:[\\s,]+(?:grazie|${NO_WORDS}))*[\\s!.]*$`, "iu");

/**
 * Riconosce un sì/no secco senza interpellare il modello. Se c'è altro
 * ("sì però alle 18") restituisce null e il messaggio va interpretato.
 */
export function quickYesNo(text: string): "si" | "no" | null {
  const t = text.trim().toLowerCase();
  if (t.length > 40) return null;
  if (NO.test(t)) return "no";
  if (YES.test(t)) return "si";
  return null;
}
