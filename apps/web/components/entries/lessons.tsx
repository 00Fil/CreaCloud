"use client";
import { useState } from "react";
import { Field, Input, Select } from "../ui";
import {
  ChoiceCards,
  EntryForm,
  EntrySection,
  EntrySummary,
  type EntryAction,
} from "./primitives";
type Tutor = { id: string; first_name: string; last_name: string };
function LessonConfiguration({
  subjects,
  tutors,
}: {
  subjects: { id: string; name: string }[];
  tutors: Tutor[];
}) {
  const [subject, setSubject] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [mode, setMode] = useState("");
  const [flex, setFlex] = useState("");
  return (
    <>
      <EntrySection title="Cosa deve studiare?">
        <Field label="Materia">
          <Select
            name="subject_id"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          >
            <option value="" disabled>
              Scegli una materia
            </option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Argomento o obiettivo"
          hint="Facoltativo: aiuta chi organizza le lezioni."
        >
          <Input name="topic" placeholder="es. Equazioni di secondo grado" />
        </Field>
      </EntrySection>
      <EntrySection title="Con quale frequenza?">
        <ChoiceCards
          segmented
          name="sessions_per_week"
          label="Lezioni ogni settimana"
          value={frequency}
          onChange={setFrequency}
          options={[1, 2, 3, 4, 5].map((n) => ({
            value: String(n),
            label: String(n),
          }))}
        />
        <ChoiceCards
          segmented
          name="duration_min"
          label="Durata di ogni incontro"
          value={duration}
          onChange={setDuration}
          options={[
            { value: "60", label: "1 ora" },
            { value: "90", label: "1 ora e 30 minuti" },
            { value: "120", label: "2 ore" },
          ]}
        />
      </EntrySection>
      <EntrySection title="Come si svolgeranno?">
        <ChoiceCards
          name="mode"
          label="Modalità della lezione"
          value={mode}
          onChange={setMode}
          options={[
            {
              value: "presenza",
              label: "In presenza",
              description: "Negli spazi del centro.",
            },
            { value: "online", label: "Online", description: "A distanza." },
            {
              value: "indifferente",
              label: "Entrambe vanno bene",
              description: "Il motore può scegliere.",
            },
          ]}
        />
        <Field label="Tutor preferito">
          <Select name="preferred_tutor_id" defaultValue="">
            <option value="">Nessuna preferenza</option>
            {tutors.map((t) => (
              <option key={t.id} value={t.id}>
                {t.first_name} {t.last_name}
              </option>
            ))}
          </Select>
        </Field>
        <ChoiceCards
          name="flexible_duration"
          label="La durata può essere adattata?"
          value={flex}
          onChange={setFlex}
          options={[
            {
              value: "off",
              label: "Mantieni la durata scelta",
              description: "Non autorizzo variazioni della durata.",
            },
            {
              value: "on",
              label: "Consenti fino a 30 minuti di variazione",
              description:
                "Il motore può adattarla se serve per trovare un incastro.",
            },
          ]}
        />
      </EntrySection>
      <EntrySummary>
        {subject && frequency && duration && mode && flex ? (
          <>
            <strong className="text-ink">La richiesta in breve</strong>
            <p className="mt-1">
              {subjects.find((s) => s.id === subject)?.name} · {frequency}{" "}
              {frequency === "1" ? "incontro" : "incontri"} a settimana ·{" "}
              {duration} minuti ·{" "}
              {mode === "indifferente"
                ? "modalità flessibile"
                : mode === "presenza"
                  ? "in presenza"
                  : "online"}
              .
            </p>
            <p className="mt-1">
              {flex === "on"
                ? "Variazione della durata consentita."
                : "Durata da mantenere."}{" "}
              Il calendario cambierà solo dopo il calcolo e la conferma di una
              bozza.
            </p>
          </>
        ) : (
          "Completa le scelte per vedere il riepilogo della richiesta. Nessuna lezione viene fissata automaticamente."
        )}
      </EntrySummary>
    </>
  );
}
export function LessonRequestEntry({
  action,
  studentId,
  familyId,
  studentName,
  subjects,
  tutors,
}: {
  action: EntryAction;
  studentId: string;
  familyId: string;
  studentName: string;
  subjects: { id: string; name: string }[];
  tutors: Tutor[];
}) {
  return (
    <EntryForm
      action={action}
      className="mt-3 rounded-2xl border bg-surface p-4"
      submitLabel={`Salva la richiesta di ${studentName}`}
      successMessage="Richiesta salvata. Ora puoi calcolare una nuova bozza."
    >
      <input type="hidden" name="student_ids" value={studentId} />
      <input type="hidden" name="family_id" value={familyId} />
      <LessonConfiguration subjects={subjects} tutors={tutors} />
    </EntryForm>
  );
}
export function MoveLessonEntry({
  action,
  id,
  path,
  date,
  time,
  tutors,
  currentTutorId,
}: {
  action: EntryAction;
  id: string;
  path: string;
  date: string;
  time: string;
  tutors: Tutor[];
  currentTutorId: string;
}) {
  return (
    <EntryForm
      action={action}
      className="border-t p-5"
      submitLabel="Salva spostamento e blocca la lezione"
      successMessage="Lezione spostata e bloccata."
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="path" value={path} />
      <EntrySection
        title="Sposta questa lezione"
        description="I valori iniziali corrispondono all’appuntamento attuale. Modifica solo ciò che cambia."
      >
        <Field label="Nuova data">
          <Input name="date" type="date" defaultValue={date} required />
        </Field>
        <Field label="Nuovo orario di inizio">
          <Input name="time" type="time" defaultValue={time} required />
        </Field>
        <Field label="Tutor">
          <Select name="tutor_id" defaultValue="">
            <option value="">Mantieni il tutor attuale</option>
            {tutors
              .filter((t) => t.id !== currentTutorId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </option>
              ))}
          </Select>
        </Field>
      </EntrySection>
      <EntrySummary>
        Lo spostamento modifica subito il calendario e blocca questa lezione: il
        motore non la sposterà nei calcoli successivi. La durata resta
        invariata.
      </EntrySummary>
    </EntryForm>
  );
}
export function CancelLessonEntry({
  action,
  id,
  path,
  late,
  threshold,
}: {
  action: EntryAction;
  id: string;
  path: string;
  late: boolean;
  threshold: number;
}) {
  return (
    <EntryForm
      action={action}
      className="p-0"
      submitVariant="danger"
      submitLabel="Annulla la lezione con queste condizioni"
      successMessage="Lezione annullata."
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="path" value={path} />
      <EntrySection
        title="Annulla questa lezione"
        description={`In base alla regola delle ${threshold} ore, l’annullamento risulta ${late ? "tardivo" : "in tempo"}. Scegli esplicitamente le condizioni da applicare.`}
      >
        <ChoiceCards
          name="kind"
          label="Come registrare l’annullamento?"
          options={[
            {
              value: "auto",
              label: "Applica la regola del centro",
              description: late
                ? "Annullamento tardivo: la lezione viene addebitata e il tutor viene compensato."
                : "Annullamento in tempo: la famiglia non paga la lezione.",
            },
            ...(late
              ? [
                  {
                    value: "in_tempo",
                    label: "Concedi l’annullamento in tempo",
                    description:
                      "Eccezione alla regola: nessun addebito alla famiglia e nessun compenso al tutor.",
                  },
                ]
              : []),
            {
              value: "senza_compenso",
              label: "Annulla senza addebito né compenso",
              description:
                "Usa questa eccezione per motivi seri: nessun addebito alla famiglia e nessun compenso al tutor.",
            },
          ]}
        />
        <Field
          label="Motivo dell’annullamento"
          hint="Facoltativo, utile per lo storico."
        >
          <Input name="reason" />
        </Field>
      </EntrySection>
      <EntrySummary>
        L’annullamento modifica subito stato e conteggi della lezione. Non è una
        semplice richiesta.
      </EntrySummary>
    </EntryForm>
  );
}
