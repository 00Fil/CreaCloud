/**
 * Date e orari nel fuso del centro (Europe/Rome).
 * Le date di calendario sono stringhe "YYYY-MM-DD"; gli orari sono minuti
 * dalla mezzanotte; i giorni della settimana vanno da 0 (lunedì) a 6.
 */

export const TZ = "Europe/Rome";
export const WEEKDAYS = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
export const WEEKDAYS_SHORT = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
export const MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

export type DateStr = string;

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Data e minuti nel fuso del centro per un istante. */
export function romeParts(at: Date): { date: DateStr; minutes: number; weekday: number } {
  const p = Object.fromEntries(partsFmt.formatToParts(at).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  return { date, minutes: Number(p.hour) * 60 + Number(p.minute), weekday: weekdayOf(date) };
}

export function todayRome(now = new Date()): DateStr {
  return romeParts(now).date;
}

/** Istante UTC corrispondente a una data e un orario del centro (gestisce l'ora legale). */
export function romeToInstant(date: DateStr, minutes: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  // due iterazioni bastano anche a cavallo del cambio d'ora
  let t = guess;
  for (let i = 0; i < 2; i++) {
    const p = romeParts(new Date(t));
    const [py, pm, pd] = p.date.split("-").map(Number);
    const seen = Date.UTC(py, pm - 1, pd, Math.floor(p.minutes / 60), p.minutes % 60);
    t += guess - seen;
  }
  return new Date(t);
}

export function parseDate(date: DateStr): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

export function formatDateStr(y: number, m: number, d: number): DateStr {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDays(date: DateStr, n: number): DateStr {
  const { y, m, d } = parseDate(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return formatDateStr(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function weekdayOf(date: DateStr): number {
  const { y, m, d } = parseDate(date);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function monthStart(date: DateStr): DateStr {
  return date.slice(0, 8) + "01";
}

export function monthEnd(date: DateStr): DateStr {
  const { y, m } = parseDate(date);
  const t = new Date(Date.UTC(y, m, 0));
  return formatDateStr(y, m, t.getUTCDate());
}

export function addMonths(date: DateStr, n: number): DateStr {
  const { y, m } = parseDate(date);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return formatDateStr(t.getUTCFullYear(), t.getUTCMonth() + 1, 1);
}

export function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function parseHhmm(value: string): number | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(value.trim()) ?? /^(\d{1,2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** "mar 21/10" */
export function shortDate(date: DateStr): string {
  const { m, d } = parseDate(date);
  return `${WEEKDAYS_SHORT[weekdayOf(date)]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** "martedì 21 ottobre" */
export function longDate(date: DateStr): string {
  const { m, d } = parseDate(date);
  return `${WEEKDAYS[weekdayOf(date)]} ${d} ${MONTHS[m - 1]}`;
}

export function monthLabel(date: DateStr): string {
  const { y, m } = parseDate(date);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Prossima data (da oggi incluso, o esclusa con `strict`) con quel giorno della settimana. */
export function nextWeekday(from: DateStr, weekday: number, strict = false): DateStr {
  let delta = (weekday - weekdayOf(from) + 7) % 7;
  if (delta === 0 && strict) delta = 7;
  return addDays(from, delta);
}

export function datesBetween(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
