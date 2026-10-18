import { addDays, hhmm, longDate, shortDate, WEEKDAYS, type DateStr } from "@/lib/domain/time";

import type { ChatState, ConstraintInfo, LessonInfo, Message, Speaker, Student, Subject } from "./types";

export const SYSTEM_PROMPT = `Sei l'assistente WhatsApp di Creattivamente, un centro di ripetizioni.
Il tuo unico compito è CAPIRE il messaggio e restituire un JSON conforme allo schema. Non esegui azioni: il sistema le valida e le esegue.

Regole:
- Scrivono genitori, ragazzi e tutor. Il contesto dice chi sta scrivendo.
- Cita studenti, lezioni e vincoli SOLO con i riferimenti del contesto (S1, L1, V1). Se non sai quale, lascia null e fai una domanda.
- Per le date usa preferibilmente tipo="data" con la data presa dal calendario fornito. "Domani" = tra_giorni 1.
- Orari sempre in formato HH:MM a 24 ore ("alle 5 del pomeriggio" = 17:00).
- Un impegno o un'indisponibilità di uno studente è "nuovo_vincolo". Se l'utente non dice di cosa si tratta, metti categoria="sconosciuta" e nella domanda chiedi gentilmente di cosa si tratta.
- Priorità proposta: 1 scuola, terapie, visite mediche; 2 sport e attività fisse, altre lezioni; 3 impegni spostabili; 4 semplici preferenze ("preferirei", "meglio se").
- "Non può più venire il martedì" è un vincolo; "domani non viene" è annulla_lezione.
- Per i tutor: disponibilità settimanale = disponibilita_tutor; un giorno di assenza = assenza_tutor.
- Se il messaggio è ambiguo o ti manca un dato indispensabile, abbassa la confidenza e scrivi la domanda.
- Se l'utente è arrabbiato, chiede una persona, parla di problemi di pagamento o di argomenti estranei alle lezioni: intento "parla_con_coordinatore".
- Il campo risposta serve solo per saluti, ringraziamenti e domande generiche. Non inventare MAI orari, date, prezzi, importi o promesse: quelle informazioni le fornisce il sistema.
- Tono: cordiale, breve, italiano semplice, dai del tu ai ragazzi e del lei/tu ai genitori come fanno loro.`;

export interface Refs {
  students: Map<string, Student>;
  lessons: Map<string, LessonInfo>;
  constraints: Map<string, ConstraintInfo>;
}

function constraintText(c: ConstraintInfo): string {
  const when = c.weekday !== null ? `ogni ${WEEKDAYS[c.weekday]}` : `il ${shortDate(c.date!)}`;
  const hours = c.start_min === 0 && c.end_min === 1440 ? "tutto il giorno" : `${hhmm(c.start_min)}–${hhmm(c.end_min)}`;
  return `${c.label} (${when}, ${hours}, priorità ${c.priority})`;
}

export function buildContext(input: {
  speaker: Speaker;
  today: DateStr;
  nowMinutes: number;
  lessons: LessonInfo[];
  constraints: ConstraintInfo[];
  subjects: Subject[];
  transcript: Message[];
  state: ChatState;
}): { text: string; refs: Refs } {
  const refs: Refs = { students: new Map(), lessons: new Map(), constraints: new Map() };
  const lines: string[] = [];
  lines.push(`Oggi è ${longDate(input.today)} (${input.today}), ore ${hhmm(input.nowMinutes)}.`);
  lines.push("Calendario prossimi giorni: " +
    Array.from({ length: 21 }, (_, i) => addDays(input.today, i)).map((d) => `${shortDate(d)}=${d}`).join(", "));

  const sp = input.speaker;
  const students: Student[] = sp.kind === "genitore" ? sp.students : sp.kind === "studente" ? [sp.student] : [];
  if (sp.kind === "genitore") lines.push(`Scrive: genitore ${sp.parent.first_name} ${sp.parent.last_name}.`);
  if (sp.kind === "studente") lines.push(`Scrive: lo studente ${sp.student.first_name} in persona.`);
  if (sp.kind === "tutor") lines.push(`Scrive: il tutor ${sp.tutor.first_name} ${sp.tutor.last_name}.`);
  if (sp.kind === "sconosciuto") lines.push("Scrive: numero non registrato.");

  students.forEach((s, i) => {
    const ref = `S${i + 1}`;
    refs.students.set(ref, s);
    lines.push(`${ref}: ${s.first_name} ${s.last_name}${s.school_level ? `, ${s.school_level}` : ""}`);
  });

  if (input.lessons.length) {
    lines.push("Prossime lezioni:");
    input.lessons.forEach((l, i) => {
      const ref = `L${i + 1}`;
      refs.lessons.set(ref, l);
      const who = sp.kind === "tutor" ? ` con ${l.student_names.join(", ")}` : ` (${l.student_names.join(", ")}) con ${l.tutor_name}`;
      lines.push(`${ref}: ${shortDate(l.date)} ${hhmm(l.start_min)}–${hhmm(l.end_min)} ${l.subject}${who}, ${l.mode}`);
    });
  } else {
    lines.push("Nessuna lezione nei prossimi giorni.");
  }

  if (input.constraints.length) {
    lines.push("Vincoli registrati:");
    input.constraints.forEach((c, i) => {
      const ref = `V${i + 1}`;
      refs.constraints.set(ref, c);
      const owner = students.find((s) => s.id === c.student_id);
      lines.push(`${ref}: ${owner?.first_name ?? ""} – ${constraintText(c)}`);
    });
  }

  lines.push("Materie del centro: " + input.subjects.map((s) => s.name).join(", "));

  if (input.state.awaiting) lines.push(`Avevi chiesto: «${input.state.awaiting.question}». Il messaggio potrebbe essere la risposta.`);
  if (input.state.pending) lines.push(`In attesa di conferma: «${input.state.pending.summary}».`);

  if (input.transcript.length) {
    lines.push("Conversazione recente (dal più vecchio):");
    for (const m of input.transcript) {
      const who = m.direction === "in" ? "Utente" : "Centro";
      lines.push(`${who}: ${(m.transcript ?? m.body).slice(0, 400)}`);
    }
  }
  return { text: lines.join("\n"), refs };
}
