/**
 * Calcolo di quanto devono le famiglie e quanto spetta ai tutor.
 * Tutti i pagamenti sono in contanti; gli importi sono IVA esclusa.
 */

import type { LessonStatus } from "./cancellation";
import type { DateStr } from "./time";

export interface BillingLesson {
  id: string;
  date: DateStr;
  startMin: number;
  endMin: number;
  status: LessonStatus;
  tutorId: string;
  studentIds: string[];
}

export interface Rates {
  defaultHourly: number;
  defaultGroupHourly: number;
  defaultTutorHourly: number;
  defaultTutorGroupHourly: number;
}

export interface StudentRate {
  id: string;
  hourlyRateCents?: number | null;
  groupHourlyRateCents?: number | null;
}

export interface TutorRate {
  id: string;
  hourlyRateCents: number;
  groupHourlyRateCents?: number | null;
}

/** maturata = già dovuta; prevista = lezione futura ancora in programma; nulla = non si paga. */
export type Accrual = "maturata" | "prevista" | "nulla";

export function accrual(lesson: Pick<BillingLesson, "status" | "date">, today: DateStr): Accrual {
  switch (lesson.status) {
    case "svolta":
    case "annullata_tardiva":
      return "maturata";
    case "programmata":
      return lesson.date < today ? "maturata" : "prevista";
    default:
      return "nulla";
  }
}

const minutes = (l: BillingLesson) => l.endMin - l.startMin;
const amount = (rateCents: number, mins: number) => Math.round((rateCents * mins) / 60);

export function studentRate(s: StudentRate, rates: Rates, group: boolean): number {
  return group
    ? (s.groupHourlyRateCents ?? rates.defaultGroupHourly)
    : (s.hourlyRateCents ?? rates.defaultHourly);
}

export function tutorRate(t: TutorRate, rates: Rates, group: boolean): number {
  if (!group) return t.hourlyRateCents || rates.defaultTutorHourly;
  return t.groupHourlyRateCents ?? rates.defaultTutorGroupHourly;
}

export interface Bucket {
  minutes: number;
  cents: number;
}

const empty = (): Bucket => ({ minutes: 0, cents: 0 });

export type PaymentState = "saldato" | "parziale" | "da_pagare" | "in_credito" | "nulla";

function paymentState(due: number, paid: number): PaymentState {
  if (due === 0 && paid === 0) return "nulla";
  if (paid > due) return "in_credito";
  if (paid === due) return "saldato";
  return paid > 0 ? "parziale" : "da_pagare";
}

export interface StudentLine {
  studentId: string;
  maturato: Bucket;
  previsto: Bucket;
  annullate: number;
}

export interface FamilyStatement {
  lines: StudentLine[];
  maturato: number;
  previsto: number;
  pagato: number;
  /** quanto manca adesso (positivo = deve pagare) */
  saldo: number;
  /** quanto mancherà a fine periodo se tutte le lezioni previste si svolgono */
  saldoStimato: number;
  stato: PaymentState;
}

export function familyStatement(
  students: StudentRate[],
  lessons: BillingLesson[],
  paymentsCents: number[],
  rates: Rates,
  today: DateStr,
): FamilyStatement {
  const byId = new Map(students.map((s) => [s.id, s]));
  const lines = new Map<string, StudentLine>(
    students.map((s) => [s.id, { studentId: s.id, maturato: empty(), previsto: empty(), annullate: 0 }]),
  );
  for (const l of lessons) {
    const group = l.studentIds.length > 1;
    const kind = accrual(l, today);
    for (const sid of l.studentIds) {
      const s = byId.get(sid);
      const line = lines.get(sid);
      if (!s || !line) continue;
      if (kind === "nulla") {
        line.annullate += 1;
        continue;
      }
      const bucket = kind === "maturata" ? line.maturato : line.previsto;
      bucket.minutes += minutes(l);
      bucket.cents += amount(studentRate(s, rates, group), minutes(l));
    }
  }
  const all = [...lines.values()];
  const maturato = all.reduce((a, l) => a + l.maturato.cents, 0);
  const previsto = all.reduce((a, l) => a + l.previsto.cents, 0);
  const pagato = paymentsCents.reduce((a, b) => a + b, 0);
  return {
    lines: all,
    maturato,
    previsto,
    pagato,
    saldo: maturato - pagato,
    saldoStimato: maturato + previsto - pagato,
    stato: paymentState(maturato, pagato),
  };
}

export interface TutorStatement {
  tutorId: string;
  maturato: Bucket;
  previsto: Bucket;
  lezioniAnnullateSenzaCompenso: number;
  pagato: number;
  residuo: number;
  residuoStimato: number;
  stato: PaymentState;
}

export function tutorStatement(
  tutor: TutorRate,
  lessons: BillingLesson[],
  payoutsCents: number[],
  rates: Rates,
  today: DateStr,
): TutorStatement {
  const maturato = empty();
  const previsto = empty();
  let senzaCompenso = 0;
  for (const l of lessons) {
    if (l.tutorId !== tutor.id) continue;
    const kind = accrual(l, today);
    if (kind === "nulla") {
      if (l.status === "annullata_senza_compenso") senzaCompenso += 1;
      continue;
    }
    const bucket = kind === "maturata" ? maturato : previsto;
    bucket.minutes += minutes(l);
    bucket.cents += amount(tutorRate(tutor, rates, l.studentIds.length > 1), minutes(l));
  }
  const pagato = payoutsCents.reduce((a, b) => a + b, 0);
  return {
    tutorId: tutor.id,
    maturato,
    previsto,
    lezioniAnnullateSenzaCompenso: senzaCompenso,
    pagato,
    residuo: maturato.cents - pagato,
    residuoStimato: maturato.cents + previsto.cents - pagato,
    stato: paymentState(maturato.cents, pagato),
  };
}

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always" } as Intl.NumberFormatOptions);

export function formatEuro(cents: number): string {
  return euro.format(cents / 100);
}

export function formatHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
