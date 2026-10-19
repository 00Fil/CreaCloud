"use client";
import { useState, useId } from "react";
import { Field, Input } from "../ui";
import {
  EntryForm,
  EntrySection,
  EntrySummary,
  type EntryAction,
} from "./primitives";
function RoomCapacity() {
  const [n, setN] = useState("1");
  const id = useId();
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label htmlFor={id} className="label-caps block text-ink-soft">
          Quanti posti sono disponibili?
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={Number(n) <= 1}
            className="size-11 shrink-0 rounded-full border text-xl disabled:opacity-40"
            aria-label="Un posto in meno"
            onClick={() => setN(String(Math.max(1, Number(n) - 1)))}
          >
            −
          </button>
          <Input
            id={id}
            aria-describedby={`${id}-hint`}
            name="capacity"
            type="number"
            min="1"
            step="1"
            required
            value={n}
            onChange={(e) => setN(e.target.value)}
            className="text-center"
          />
          <button
            type="button"
            className="size-11 shrink-0 rounded-full border text-xl"
            aria-label="Un posto in più"
            onClick={() => setN(String(Number(n) + 1))}
          >
            +
          </button>
        </div>
        <p id={`${id}-hint`} className="text-xs text-ink-soft">
          Ogni postazione deve avere almeno un posto.
        </p>
      </div>
      <EntrySummary>
        {n && Number(n) > 0
          ? `Questa postazione offrirà ${n} ${Number(n) === 1 ? "posto" : "posti"} per le lezioni in presenza. La capienza limita gli studenti collocabili contemporaneamente in quello spazio.`
          : "Indica una capienza di almeno un posto."}
      </EntrySummary>
    </div>
  );
}
export function RoomEntry({ action }: { action: EntryAction }) {
  return (
    <EntryForm
      action={action}
      className="border-t p-5"
      submitLabel="Aggiungi postazione"
      successMessage="Postazione aggiunta e disponibile per le nuove pianificazioni."
    >
      <EntrySection
        title="Un nuovo spazio per le lezioni"
        description="Dagli un nome riconoscibile e indica la sua capienza reale."
      >
        <Field label="Nome della postazione">
          <Input name="name" required placeholder="es. Aula verde · Tavolo 2" />
        </Field>
        <RoomCapacity />
      </EntrySection>
    </EntryForm>
  );
}
export function SubjectEntry({ action }: { action: EntryAction }) {
  return (
    <EntryForm
      action={action}
      className="border-t p-5"
      submitLabel="Aggiungi materia"
      successMessage="Materia aggiunta. Ora puoi associarla ai tutor e alle richieste."
    >
      <EntrySection title="Una nuova materia">
        <Field label="Come si chiama?">
          <Input name="name" required placeholder="es. Matematica" />
        </Field>
      </EntrySection>
      <EntrySummary>
        La materia diventerà selezionabile nelle richieste di lezione. Ricorda
        di associarla ai tutor che possono insegnarla.
      </EntrySummary>
    </EntryForm>
  );
}
