"use client";
import { useState } from "react";
import { Field, Input, Select, Textarea } from "../ui";
import {
  ChoiceCards,
  DayDuration,
  EntryForm,
  EntrySection,
  EntrySummary,
  MultiChoice,
  validateDuration,
  type EntryAction,
} from "./primitives";
const days = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function HoursEntry({
  action,
  tutorId,
}: {
  action: EntryAction;
  tutorId?: string;
}) {
  return (
    <EntryForm
      action={action}
      className="border-t p-5"
      submitLabel={
        tutorId ? "Aggiungi disponibilità" : "Aggiungi orario del centro"
      }
      successMessage="Fascia oraria aggiunta ai giorni selezionati."
      validate={(d) =>
        !d.getAll("weekday").length
          ? "Seleziona almeno un giorno a cui applicare questa fascia."
          : String(d.get("end")) <= String(d.get("start"))
            ? "L’orario di chiusura deve essere successivo all’apertura."
            : null
      }
    >
      {tutorId && <input type="hidden" name="tutor_id" value={tutorId} />}
      <EntrySection
        title={
          tutorId ? "Quando è disponibile?" : "Aggiungi una fascia di apertura"
        }
        description="Scegli i giorni, poi indica una fascia. Per una pausa, aggiungi separatamente mattina e pomeriggio."
      >
        <MultiChoice
          compact
          name="weekday"
          label="Giorni della settimana"
          options={days.map((label, i) => ({ label, value: String(i) }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dalle">
            <Input name="start" type="time" required />
          </Field>
          <Field label="Alle">
            <Input name="end" type="time" required />
          </Field>
        </div>
      </EntrySection>
      <EntrySummary>
        {tutorId
          ? "La disponibilità sarà usata per i prossimi calcoli. Le lezioni già confermate non vengono spostate da questo inserimento."
          : "La nuova fascia verrà usata per collocare le lezioni in presenza nelle prossime pianificazioni."}
      </EntrySummary>
    </EntryForm>
  );
}
function ClosureDates() {
  const [kind, setKind] = useState("");
  return (
    <>
      <ChoiceCards
        name="closure_kind"
        label="Quanto rimane chiuso il centro?"
        value={kind}
        onChange={setKind}
        options={[
          {
            value: "one",
            label: "Un solo giorno",
            description: "Festività o chiusura occasionale.",
          },
          {
            value: "period",
            label: "Più giorni consecutivi",
            description: "Vacanze, ponti o chiusure prolungate.",
          },
        ]}
      />
      {kind && (
        <div className="mt-3 grid grid-cols-1 gap-3 @[26rem]:grid-cols-2">
          <Field label={kind === "one" ? "Giorno di chiusura" : "Primo giorno"}>
            <Input name="from" type="date" required />
          </Field>
          {kind === "period" && (
            <Field label="Ultimo giorno incluso">
              <Input name="to" type="date" required />
            </Field>
          )}
        </div>
      )}
    </>
  );
}
export function ClosureEntry({ action }: { action: EntryAction }) {
  return (
    <EntryForm
      action={action}
      className="border-t p-5"
      submitLabel="Registra chiusura"
      successMessage="Chiusura registrata."
      validate={(d) =>
        !d.get("closure_kind")
          ? "Scegli una chiusura di un giorno o di più giorni."
          : d.get("to") && String(d.get("to")) < String(d.get("from"))
            ? "L’ultimo giorno non può precedere il primo."
            : d.get("to") &&
                (Date.parse(String(d.get("to"))) -
                  Date.parse(String(d.get("from")))) /
                  86400000 >=
                  120
              ? "Puoi inserire al massimo 120 giorni per volta."
              : null
      }
    >
      <EntrySection
        title="Quando sarà chiuso?"
        description="Le date iniziale e finale sono entrambe incluse."
      >
        <ClosureDates />
        <Field
          label="Motivo della chiusura"
          hint="Facoltativo, ma utile a chi consulta il calendario."
        >
          <Input name="note" placeholder="es. Vacanze di Natale" />
        </Field>
      </EntrySection>
      <EntrySummary>
        Le nuove pianificazioni eviteranno queste date. Le lezioni già presenti
        nel calendario non vengono annullate automaticamente.
      </EntrySummary>
    </EntryForm>
  );
}
export function AbsenceEntry({
  action,
  tutorId,
}: {
  action: EntryAction;
  tutorId: string;
}) {
  return (
    <EntryForm
      action={action}
      className="border-t p-5"
      submitLabel="Registra assenza"
      successMessage="Assenza registrata. Controlla le eventuali lezioni già confermate."
      validate={validateDuration}
    >
      <input type="hidden" name="tutor_id" value={tutorId} />
      <EntrySection
        title="Quando non è disponibile?"
        description="Indica il giorno e scegli se l’assenza riguarda alcune ore o tutta la giornata."
      >
        <Field label="Data dell’assenza">
          <Input name="date" type="date" required />
        </Field>
        <DayDuration />
        <Field label="Nota per il coordinamento" hint="Facoltativa.">
          <Textarea
            name="note"
            placeholder="es. Indisponibile per un impegno personale"
          />
        </Field>
      </EntrySection>
      <EntrySummary>
        Il motore eviterà questa fascia nei prossimi calcoli. Verifica
        separatamente le lezioni già confermate.
      </EntrySummary>
    </EntryForm>
  );
}
function Recurrence() {
  const [kind, setKind] = useState("");
  return (
    <>
      <ChoiceCards
        name="recurrence"
        label="Quando si ripete?"
        value={kind}
        onChange={setKind}
        options={[
          { value: "weekly", label: "Ogni settimana" },
          { value: "once", label: "Una data precisa" },
        ]}
      />
      {kind === "weekly" && (
        <Field label="Giorno della settimana">
          <Select name="weekday" defaultValue="" required>
            <option value="" disabled>
              Scegli il giorno
            </option>
            {days.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {kind === "once" && (
        <Field label="Data dell’impegno">
          <Input name="date" type="date" required />
        </Field>
      )}
    </>
  );
}
export function ConstraintEntry({
  action,
  studentId,
  familyId,
  studentName,
}: {
  action: EntryAction;
  studentId: string;
  familyId: string;
  studentName: string;
}) {
  return (
    <EntryForm
      action={action}
      className="mt-3 rounded-2xl border bg-surface p-4"
      submitLabel={`Aggiungi impegno di ${studentName}`}
      successMessage="Impegno aggiunto al profilo."
      validate={(d) =>
        !d.get("recurrence")
          ? "Scegli se l’impegno è settimanale o ha una data precisa."
          : validateDuration(d)
      }
    >
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="family_id" value={familyId} />
      <EntrySection
        title={`Un impegno di ${studentName}`}
        description="Aiuta il motore a non sovrapporre le lezioni agli altri impegni."
      >
        <Field label="Di quale impegno si tratta?">
          <Input
            name="label"
            required
            placeholder="es. Allenamento di calcio"
          />
        </Field>
        <Field label="Categoria">
          <Select name="category" defaultValue="" required>
            <option value="" disabled>
              Scegli la categoria
            </option>
            {[
              "scuola",
              "salute",
              "terapia",
              "sport",
              "altra_lezione",
              "lavoro",
              "famiglia",
              "religione",
              "preferenza",
              "altro",
            ].map((v) => (
              <option key={v} value={v}>
                {v.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Recurrence />
        <DayDuration />
      </EntrySection>
      <ChoiceCards
        name="priority"
        label="Quanto è importante rispettarlo?"
        options={[
          {
            value: "1",
            label: "Da non spostare",
            description: "P1 · Vincolo inderogabile.",
          },
          {
            value: "2",
            label: "Molto importante",
            description: "P2 · Da rispettare se possibile.",
          },
          {
            value: "3",
            label: "Una preferenza",
            description: "P3 · Si può valutare un’alternativa.",
          },
          {
            value: "4",
            label: "Sarebbe comodo",
            description: "P4 · Non deve bloccare le altre scelte.",
          },
        ]}
      />
      <EntrySummary>
        L’impegno guiderà le nuove bozze. Non modifica automaticamente le
        lezioni già confermate.
      </EntrySummary>
    </EntryForm>
  );
}
