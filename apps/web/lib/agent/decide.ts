/**
 * Dall'interpretazione del modello alla decisione: validazione, regole del
 * centro, testi di conferma. Funzione pura, testabile senza modello né database.
 */

import { hoursBefore } from "@/lib/domain/cancellation";
import { addDays, hhmm, shortDate, WEEKDAYS, type DateStr } from "@/lib/domain/time";

import type { Refs } from "./prompt";
import { normalizeDuration, resolveDate, resolveTime } from "./resolve";
import { CATEGORY_LABEL, clampPriority, type Interpretation } from "./schema";
import type {
  Action,
  ConstraintInfo,
  LessonInfo,
  PendingActionInput,
  PendingConfirmation,
  Speaker,
  Student,
  Subject,
} from "./types";

export interface DecideInput {
  interp: Interpretation;
  refs: Refs;
  speaker: Speaker;
  subjects: Subject[];
  lessons: LessonInfo[];
  today: DateStr;
  now: Date;
  cancellationHours: number;
}

export interface Decision {
  reply: string;
  pending?: Omit<PendingConfirmation, "expiresAt">;
  awaiting?: string;
  queue?: Omit<PendingActionInput, "chatId" | "sourceMessageId">;
  attention?: boolean;
  takeover?: boolean;
}

const CONFIRM = "\n\nConfermi? Rispondi *sì* o *no*.";
const HOLD = "Ho girato il messaggio al coordinatore, che ti risponderà al più presto.";

export function lessonText(l: LessonInfo, withStudents = true): string {
  const who = withStudents ? ` (${l.student_names.join(", ")})` : "";
  return `${shortDate(l.date)} ${hhmm(l.start_min)}–${hhmm(l.end_min)} ${l.subject} con ${l.tutor_name}${who}`;
}

function hours(start: number, end: number): string {
  return start === 0 && end === 1440 ? "tutto il giorno" : `${hhmm(start)}–${hhmm(end)}`;
}

function daysText(days: number[]): string {
  const names = [...new Set(days)].sort().map((d) => WEEKDAYS[d]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0];
}

function ask(question: string): Decision {
  return { reply: question, awaiting: question };
}

function studentsOf(sp: Speaker): Student[] {
  return sp.kind === "genitore" ? sp.students : sp.kind === "studente" ? [sp.student] : [];
}

function pickStudent(input: DecideInput): Student | Decision {
  const students = studentsOf(input.speaker);
  const ref = input.interp.studente_ref;
  if (ref && input.refs.students.has(ref)) return input.refs.students.get(ref)!;
  if (students.length === 1) return students[0];
  if (!students.length) return { reply: HOLD, attention: true };
  return ask(`Per quale dei ragazzi? (${students.map((s) => s.first_name).join(", ")})`);
}

function pickLesson(input: DecideInput, student: Student | null): LessonInfo | Decision {
  const ref = input.interp.lezione_ref;
  if (ref && input.refs.lessons.has(ref)) return input.refs.lessons.get(ref)!;
  const candidates = input.lessons.filter(
    (l) =>
      l.status === "programmata" &&
      (!student || l.student_ids.includes(student.id)) &&
      l.date <= addDays(input.today, 7),
  );
  if (candidates.length === 1) return candidates[0];
  if (!candidates.length) return { reply: "Non trovo lezioni in programma nei prossimi giorni. " + HOLD, attention: true };
  return ask(
    "Quale lezione intendi?\n" + candidates.slice(0, 5).map((l) => `• ${lessonText(l)}`).join("\n"),
  );
}

const isDecision = (x: unknown): x is Decision => typeof x === "object" && x !== null && "reply" in x;

function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function matchSubject(name: string, subjects: Subject[]): Subject | null {
  const n = normalize(name);
  if (!n) return null;
  return (
    subjects.find((s) => normalize(s.name) === n) ??
    subjects.find((s) => normalize(s.name).startsWith(n) || n.startsWith(normalize(s.name))) ??
    subjects.find((s) => normalize(s.name).includes(n)) ??
    null
  );
}

/** Testo di sicurezza: niente numeri o importi scritti liberamente dal modello. */
export function safeFreeText(text: string, fallback: string): string {
  const t = text.trim();
  if (!t || t.length > 400 || /\d/.test(t) || /€|euro/i.test(t)) return fallback;
  return t;
}

function overlapsConstraint(l: LessonInfo, days: number[], date: DateStr | null, start: number, end: number): boolean {
  const weekday = (new Date(`${l.date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const sameDay = date ? l.date === date : days.includes(weekday);
  return sameDay && l.start_min < end && start < l.end_min;
}

// ---------------------------------------------------------------- intenti

function nuovoVincolo(input: DecideInput): Decision {
  const v = input.interp.vincolo;
  if (!v) return ask(input.interp.domanda ?? "Mi descrivi l'impegno? Giorno, orario e di cosa si tratta.");
  const student = pickStudent(input);
  if (isDecision(student)) return student;
  if (v.categoria === "sconosciuta") {
    return ask(
      `Di che impegno si tratta per ${student.first_name}? (per esempio scuola, sport, visita medica, altra attività) Mi serve per capire quanto è importante.`,
    );
  }
  let date: DateStr | null = null;
  let days: number[] = [];
  if (v.ricorrenza === "data") {
    date = resolveDate(v.data, input.today);
    if (!date) return ask("In che giorno preciso?");
  } else {
    days = [...new Set(v.giorni_settimana)];
    if (!days.length) return ask("In quali giorni della settimana?");
  }
  let start = resolveTime(v.dalle);
  let end = resolveTime(v.alle);
  if (start === null && end === null) {
    start = 0;
    end = 1440;
  }
  if (start === null || end === null || end <= start) return ask("Da che ora a che ora?");
  const priority = clampPriority(v.categoria, v.priorita_proposta);
  const validTo = resolveDate(v.fino_al, input.today);
  const label = v.descrizione.trim() || CATEGORY_LABEL[v.categoria];
  const when = date ? `il ${shortDate(date)}` : `ogni ${daysText(days)}`;
  const summary = `${student.first_name}: ${label}, ${when}, ${hours(start, end)}${validTo ? ` fino al ${shortDate(validTo)}` : ""}`;
  const action: Action = {
    type: "aggiungi_vincolo",
    studentId: student.id,
    priority,
    category: v.categoria,
    label,
    weekdays: days,
    date,
    startMin: start,
    endMin: end,
    validTo,
  };
  const clashes = input.lessons.filter(
    (l) => l.status === "programmata" && l.student_ids.includes(student.id) && overlapsConstraint(l, days, date, start!, end!),
  );
  const clashText = clashes.length
    ? `\n\nSi sovrappone a ${clashes.length === 1 ? "questa lezione" : "queste lezioni"}:\n${clashes
        .slice(0, 4)
        .map((l) => `• ${lessonText(l, false)}`)
        .join("\n")}\nIl coordinatore troverà un nuovo orario.`
    : "";
  return {
    reply: `Ho capito così: ${summary}.${clashText}${CONFIRM}`,
    pending: {
      action,
      summary,
      needsCoordinator: false,
      reason: "",
      doneMessage: `Registrato ✅ ${summary}.${clashes.length ? " Ti scriviamo appena sistemato l'orario delle lezioni." : ""}`,
      followUp: clashes.length
        ? {
            kind: "conflitto_vincolo",
            summary: `Nuovo vincolo (priorità ${priority}) in conflitto con ${clashes.length} lezioni: ${summary}`,
            reason: clashes.map((l) => lessonText(l)).join("; "),
          }
        : undefined,
    },
  };
}

function rimuoviVincolo(input: DecideInput): Decision {
  const ref = input.interp.vincolo_ref;
  const c: ConstraintInfo | undefined = ref ? input.refs.constraints.get(ref) : undefined;
  if (!c) return ask("Quale impegno non c'è più?");
  const summary = `rimuovere l'impegno «${c.label}»`;
  return {
    reply: `Vuoi ${summary}?${CONFIRM}`,
    pending: {
      action: { type: "rimuovi_vincolo", constraintId: c.id },
      summary,
      needsCoordinator: false,
      reason: "",
      doneMessage: `Fatto ✅ ho tolto «${c.label}».`,
    },
  };
}

function disponibilita(input: DecideInput): Decision {
  if (input.speaker.kind !== "tutor") return { reply: HOLD, attention: true };
  const d = input.interp.disponibilita;
  if (!d || !d.fasce.length) return ask("In quali giorni e orari sei disponibile?");
  const windows = [];
  for (const f of d.fasce) {
    const s = resolveTime(f.dalle);
    const e = resolveTime(f.alle);
    if (s === null || e === null || e <= s) return ask(`Non ho capito l'orario di ${WEEKDAYS[f.giorno_settimana]}: da che ora a che ora?`);
    windows.push({ weekday: f.giorno_settimana, startMin: s, endMin: e });
  }
  windows.sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin);
  const list = windows.map((w) => `${WEEKDAYS[w.weekday]} ${hhmm(w.startMin)}–${hhmm(w.endMin)}`).join(", ");
  const summary = d.sostituisce_tutto ? `nuova disponibilità settimanale: ${list}` : `disponibilità aggiunta: ${list}`;
  const tutorId = input.speaker.tutor.id;
  const outside = input.lessons.filter(
    (l) =>
      l.status === "programmata" &&
      d.sostituisce_tutto &&
      !windows.some((w) => {
        const weekday = (new Date(`${l.date}T12:00:00Z`).getUTCDay() + 6) % 7;
        return w.weekday === weekday && w.startMin <= l.start_min && l.end_min <= w.endMin;
      }),
  );
  return {
    reply: `Registro questa ${summary}.${outside.length ? `\n\nAttenzione: ${outside.length} lezioni in programma cadono fuori da questi orari, le segnalo al coordinatore.` : ""}${CONFIRM}`,
    pending: {
      action: { type: "disponibilita_tutor", tutorId, windows, replaceAll: d.sostituisce_tutto },
      summary,
      needsCoordinator: false,
      reason: "",
      doneMessage: "Grazie, disponibilità aggiornata ✅",
      followUp: outside.length
        ? {
            kind: "conflitto_disponibilita",
            summary: `Nuova disponibilità di ${input.speaker.tutor.first_name}: ${outside.length} lezioni fuori orario`,
            reason: outside.map((l) => lessonText(l)).join("; "),
          }
        : undefined,
    },
  };
}

function assenza(input: DecideInput): Decision {
  if (input.speaker.kind !== "tutor") return { reply: HOLD, attention: true };
  const a = input.interp.assenza;
  const from = resolveDate(a?.dal, input.today);
  if (!a || !from) return ask("In che giorno non sarai disponibile?");
  const to = resolveDate(a.al, input.today) ?? from;
  if (to < from) return ask("Non ho capito il periodo: da che giorno a che giorno?");
  let start = resolveTime(a.dalle);
  let end = resolveTime(a.alle);
  if (start === null || end === null || end <= start) {
    start = 0;
    end = 1440;
  }
  const period = from === to ? `il ${shortDate(from)}` : `dal ${shortDate(from)} al ${shortDate(to)}`;
  const summary = `assenza ${period}, ${hours(start, end)}`;
  const affected = input.lessons.filter(
    (l) => l.status === "programmata" && l.date >= from && l.date <= to && l.start_min < end! && start! < l.end_min,
  );
  return {
    reply: `Registro la tua ${summary}.${affected.length ? `\n\nHai ${affected.length} lezioni in quei giorni: le segnalo al coordinatore per spostarle.` : ""}${CONFIRM}`,
    pending: {
      action: { type: "assenza_tutor", tutorId: input.speaker.tutor.id, from, to, startMin: start, endMin: end, note: a.motivo },
      summary,
      needsCoordinator: false,
      reason: a.motivo,
      doneMessage: "Registrato ✅ Grazie per avermi avvisato.",
      followUp: affected.length
        ? {
            kind: "lezioni_da_ricollocare",
            summary: `${input.speaker.tutor.first_name} assente ${period}: ${affected.length} lezioni da ricollocare`,
            reason: affected.map((l) => lessonText(l)).join("; "),
          }
        : undefined,
    },
  };
}

function richiestaLezioni(input: DecideInput): Decision {
  const r = input.interp.richiesta_lezioni;
  if (!r) return ask("Per quale materia vorresti le lezioni?");
  const student = pickStudent(input);
  if (isDecision(student)) return student;
  const subject = matchSubject(r.materia, input.subjects);
  if (!subject) return ask(`Per quale materia? (${input.subjects.map((s) => s.name).join(", ")})`);
  const duration = normalizeDuration(r.durata_minuti) ?? 60;
  const sessions = r.singola ? 1 : (r.lezioni_settimana ?? 1);
  const mode = r.modalita ?? "presenza";
  const date = r.singola ? resolveDate(r.data, input.today) : null;
  const durText = duration === 60 ? "1 ora" : duration === 90 ? "1 ora e mezza" : "2 ore";
  const what = r.singola
    ? `una lezione extra di ${subject.name} da ${durText}${date ? ` intorno al ${shortDate(date)}` : ""}`
    : `${sessions} ${sessions === 1 ? "lezione" : "lezioni"} a settimana di ${subject.name} da ${durText}`;
  const summary = `${student.first_name}: ${what}${mode !== "presenza" ? ` (${mode})` : ""}${r.argomento ? `, argomento: ${r.argomento}` : ""}`;
  return {
    reply: `Ricapitolo: ${summary}.${CONFIRM}`,
    pending: {
      action: {
        type: "richiesta_lezioni",
        studentId: student.id,
        subjectId: subject.id,
        sessionsPerWeek: sessions,
        durationMin: duration,
        mode,
        topic: r.argomento,
        single: r.singola,
        windowFrom: date ? addDays(date, -2) : null,
        windowTo: date ? addDays(date, 2) : null,
      },
      summary,
      needsCoordinator: true,
      reason: "Nuova richiesta di lezioni",
      doneMessage: "Perfetto, ho passato la richiesta al coordinatore: ti confermiamo giorno e orario appena pianificato.",
    },
  };
}

function modificaLezioni(input: DecideInput): Decision {
  const m = input.interp.modifica_lezioni;
  const student = pickStudent(input);
  if (isDecision(student)) return student;
  if (!m || (!m.lezioni_settimana && !m.durata_minuti)) return ask("Cosa vorresti cambiare: numero di lezioni a settimana o durata?");
  const duration = normalizeDuration(m.durata_minuti);
  const parts = [
    m.lezioni_settimana ? `${m.lezioni_settimana} lezioni a settimana` : null,
    duration ? `durata ${duration} minuti` : null,
  ].filter(Boolean);
  const lesson = input.refs.lessons.get(input.interp.lezione_ref ?? "");
  const summary = `${student.first_name}: passare a ${parts.join(", ")}${lesson ? ` per ${lesson.subject}` : ""}`;
  return {
    reply: `Ricapitolo: ${summary}.${CONFIRM}`,
    pending: {
      action: {
        type: "modifica_lezioni",
        requestId: lesson?.request_id ?? null,
        studentId: student.id,
        sessionsPerWeek: m.lezioni_settimana,
        durationMin: duration,
        note: m.nota,
      },
      summary,
      needsCoordinator: true,
      reason: "Cambio del numero o della durata delle lezioni",
      doneMessage: "Ricevuto, ho inoltrato la modifica al coordinatore: ti aggiorniamo noi sul nuovo calendario.",
    },
  };
}

function spostaLezione(input: DecideInput): Decision {
  const student = input.speaker.kind === "tutor" ? null : pickStudent(input);
  if (student && isDecision(student)) return student;
  const lesson = pickLesson(input, student);
  if (isDecision(lesson)) return lesson;
  const s = input.interp.spostamento;
  const date = resolveDate(s?.nuova_data, input.today);
  const start = resolveTime(s?.nuovo_orario);
  const wish = date || start !== null ? ` a ${date ? shortDate(date) : "stesso giorno"}${start !== null ? ` alle ${hhmm(start)}` : ""}` : "";
  const summary = `spostare la lezione di ${lessonText(lesson)}${wish}`;
  return {
    reply: `Vuoi ${summary}?${CONFIRM}`,
    pending: {
      action: { type: "sposta_lezione", lessonId: lesson.id, date, startMin: start, note: s?.nota ?? "" },
      summary,
      needsCoordinator: true,
      reason: "Richiesta di spostamento",
      doneMessage: "Ho inoltrato la richiesta di spostamento al coordinatore, ti confermiamo il nuovo orario appena possibile.",
    },
  };
}

function annullaLezione(input: DecideInput): Decision {
  const student = input.speaker.kind === "tutor" ? null : pickStudent(input);
  if (student && isDecision(student)) return student;
  const lesson = pickLesson(input, student);
  if (isDecision(lesson)) return lesson;
  if (lesson.status !== "programmata") return { reply: "Questa lezione risulta già annullata." };
  const left = hoursBefore(lesson.date, lesson.start_min, input.now);
  if (left <= 0) return { reply: "Questa lezione è già iniziata o passata. " + HOLD, attention: true };
  const reason = input.interp.annullamento?.motivo ?? "";
  const by = input.speaker.kind;
  const late = left < input.cancellationHours;
  const desc = lessonText(lesson);

  // tutor, ragazzi e lezioni di gruppo: decide sempre il coordinatore
  if (input.speaker.kind !== "genitore" || lesson.student_ids.length > 1) {
    const summary = `annullare la lezione di ${desc}`;
    return {
      reply: `Vuoi ${summary}?${late && input.speaker.kind !== "tutor" ? " Mancano meno di 24 ore: secondo il regolamento verrebbe comunque addebitata, salvo casi eccezionali valutati dal coordinatore." : ""}${CONFIRM}`,
      pending: {
        action: { type: "annulla_lezione", lessonId: lesson.id, status: late ? "annullata_tardiva" : "annullata_in_tempo", reason, by },
        summary,
        needsCoordinator: true,
        reason: `Annullamento richiesto da ${by}${late ? " con meno di 24 ore" : ""}${reason ? `: ${reason}` : ""}`,
        doneMessage: "Ho inoltrato la richiesta al coordinatore, che ti confermerà a breve.",
      },
    };
  }
  if (!late) {
    const summary = `annullare la lezione di ${desc}`;
    return {
      reply: `Vuoi ${summary}? Con più di 24 ore di preavviso non viene addebitata.${CONFIRM}`,
      pending: {
        action: { type: "annulla_lezione", lessonId: lesson.id, status: "annullata_in_tempo", reason, by },
        summary,
        needsCoordinator: false,
        reason,
        doneMessage: `Fatto ✅ lezione di ${shortDate(lesson.date)} annullata, senza addebito.`,
      },
    };
  }
  const summary = `annullare la lezione di ${desc} (meno di 24 ore)`;
  return {
    reply: `Mancano meno di 24 ore alla lezione di ${desc}: secondo il regolamento viene comunque addebitata, salvo casi eccezionali che valuta il coordinatore. Vuoi annullarla lo stesso?${CONFIRM}`,
    pending: {
      action: { type: "annulla_lezione", lessonId: lesson.id, status: "annullata_tardiva", reason, by },
      summary,
      needsCoordinator: false,
      reason,
      doneMessage: "Lezione annullata. Ho segnalato il motivo al coordinatore, che valuterà se si tratta di un caso eccezionale.",
      followUp: {
        kind: "annullamento_tardivo",
        summary: `Annullamento tardivo: ${desc}`,
        reason: reason || "motivo non indicato",
      },
    },
  };
}

function infoLezioni(input: DecideInput): Decision {
  const upcoming = input.lessons.filter((l) => l.status === "programmata").slice(0, 8);
  if (!upcoming.length) return { reply: "Al momento non risultano lezioni in programma nelle prossime tre settimane." };
  const tutor = input.speaker.kind === "tutor";
  return {
    reply:
      "Ecco le prossime lezioni:\n" +
      upcoming
        .map((l) =>
          tutor
            ? `• ${shortDate(l.date)} ${hhmm(l.start_min)}–${hhmm(l.end_min)} ${l.subject} con ${l.student_names.join(", ")}`
            : `• ${lessonText(l, studentsOf(input.speaker).length > 1)}`,
        )
        .join("\n"),
  };
}

// ---------------------------------------------------------------- ingresso

export function decide(input: DecideInput): Decision {
  const { interp } = input;
  if (interp.confidenza < 0.6 && interp.domanda && !["saluto", "ringraziamento"].includes(interp.intento)) {
    return ask(safeQuestion(interp.domanda));
  }
  switch (interp.intento) {
    case "nuovo_vincolo":
      return nuovoVincolo(input);
    case "rimuovi_vincolo":
      return rimuoviVincolo(input);
    case "disponibilita_tutor":
      return disponibilita(input);
    case "assenza_tutor":
      return assenza(input);
    case "richiesta_lezioni":
      return richiestaLezioni(input);
    case "modifica_lezioni":
      return modificaLezioni(input);
    case "sposta_lezione":
      return spostaLezione(input);
    case "annulla_lezione":
      return annullaLezione(input);
    case "info_lezioni":
      return infoLezioni(input);
    case "info_pagamenti":
      return { reply: "Ti faccio avere il riepilogo dal coordinatore.", attention: true };
    case "parla_con_coordinatore":
      return { reply: "Certo, ti risponde a breve il coordinatore.", attention: true, takeover: true };
    case "saluto":
    case "ringraziamento":
    case "conferma":
      return { reply: safeFreeText(interp.risposta, "Grazie a te! 😊") };
    case "rifiuto":
      return { reply: "Va bene, nessun problema." };
    default:
      return { reply: HOLD, attention: true };
  }
}

function safeQuestion(q: string): string {
  return q.length > 300 ? "Mi puoi dare qualche dettaglio in più?" : q;
}
