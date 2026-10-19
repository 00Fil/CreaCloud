/**
 * Formattazione per l'interfaccia, in italiano e nel fuso del centro.
 * Sicura sia sul server sia nel browser.
 */

import { formatEuro, formatHours } from "@/lib/domain/billing";
import { hhmm, longDate, MONTHS, parseHhmm, romeParts, shortDate, todayRome, addDays, WEEKDAYS_SHORT, weekdayOf, type DateStr } from "@/lib/domain/time";

export { formatEuro, formatHours };

// ------------------------------------------------------------------ denaro

/** Centesimi → testo per un campo ("12,50"); vuoto se null. */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "";
  const euros = Math.trunc(cents / 100);
  const rest = Math.abs(cents % 100);
  return rest ? `${euros},${String(rest).padStart(2, "0")}` : String(euros);
}

/** "12,50" | "12.50" | "1.200,00" → centesimi; null se vuoto o non valido. */
export function parseEuroInput(text: string): number | null {
  let t = text.trim().replace(/\s|€/g, "");
  if (!t) return null;
  // "1.200,50": punto delle migliaia e virgola decimale
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

// ------------------------------------------------------------------ orari e date

/** Minuti dalla mezzanotte → "HH:MM". */
export function minutesToTime(minutes: number): string {
  return hhmm(minutes);
}

/** "HH:MM" → minuti dalla mezzanotte; null se vuoto o non valido. */
export function timeToMinutes(value: string): number | null {
  return value ? parseHhmm(value) : null;
}

/** "16:00–17:30" */
export function formatTimeRange(startMin: number, endMin: number): string {
  return `${hhmm(startMin)}–${hhmm(endMin)}`;
}

/** "martedì 21 ottobre" */
export function formatDateLong(date: DateStr): string {
  return longDate(date);
}

/** "mar 21/10" */
export function formatDateShort(date: DateStr): string {
  return shortDate(date);
}

/** "21 ott 2026" */
export function formatDateCompact(date: DateStr): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

/** Oggi, domani, ieri o data breve. */
export function formatDayRelative(date: DateStr, today: DateStr = todayRome()): string {
  if (date === today) return "Oggi";
  if (date === addDays(today, 1)) return "Domani";
  if (date === addDays(today, -1)) return "Ieri";
  return shortDate(date);
}

/** Ora di un istante nel fuso del centro: "14:05". */
export function formatClock(at: string | Date): string {
  return hhmm(romeParts(new Date(at)).minutes);
}

/**
 * Orario compatto per elenchi (come WhatsApp): "14:05" oggi, "Ieri",
 * giorno della settimana negli ultimi 7 giorni, altrimenti "21/10/26".
 */
export function formatListTime(at: string | Date, now: Date = new Date()): string {
  const { date, minutes } = romeParts(new Date(at));
  const today = romeParts(now).date;
  if (date === today) return hhmm(minutes);
  if (date === addDays(today, -1)) return "Ieri";
  if (date > addDays(today, -7)) return WEEKDAYS_SHORT[weekdayOf(date)];
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/** Separatore di giorno nella chat: "Oggi", "Ieri", "martedì 21 ottobre". */
export function formatChatDay(at: string | Date, now: Date = new Date()): string {
  const { date } = romeParts(new Date(at));
  const today = romeParts(now).date;
  if (date === today) return "Oggi";
  if (date === addDays(today, -1)) return "Ieri";
  const long = longDate(date);
  return date.slice(0, 4) === today.slice(0, 4) ? long : `${long} ${date.slice(0, 4)}`;
}

/** Data di calendario di un istante nel fuso del centro. */
export function dateOf(at: string | Date): DateStr {
  return romeParts(new Date(at)).date;
}

/** "tra 3 ore", "2 giorni fa", "adesso". */
export function formatRelative(at: string | Date, now: Date = new Date()): string {
  const diff = new Date(at).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
  if (abs < 45_000) return "adesso";
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), "day");
  return rtf.format(Math.round(diff / (30 * 86_400_000)), "month");
}

/** Durata in secondi → "1:05" o "1:02:05". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// ------------------------------------------------------------------ persone e file

export function fullName(p: { first_name?: string | null; last_name?: string | null } | null | undefined): string {
  if (!p) return "";
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
}

/** Iniziali per gli avatar: "Maria Rossi" → "MR". */
export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** "+393331234567" → "+39 333 123 4567"; i contatti senza numero restano leggibili. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  if (phone.startsWith("lid:")) return "Numero nascosto";
  const m = /^\+39(3\d{2})(\d{3})(\d{3,4})$/.exec(phone);
  if (m) return `+39 ${m[1]} ${m[2]} ${m[3]}`;
  const it = /^\+39(0\d{1,3})(\d{3,8})$/.exec(phone);
  if (it) return `+39 ${it[1]} ${it[2]}`;
  return phone;
}

/** 1536 → "1,5 kB" */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  const units = ["B", "kB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString("it-IT", { maximumFractionDigits: i ? 1 : 0 })} ${units[i]}`;
}

/** Plurale semplice: plural(1, "lezione", "lezioni") → "1 lezione". */
export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("it-IT")} ${n === 1 ? one : many}`;
}
