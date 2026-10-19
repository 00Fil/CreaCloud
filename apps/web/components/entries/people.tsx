"use client";
import { Field, Input, Select } from "../ui";
import {
  EntryForm,
  EntrySection,
  EntrySummary,
  TeachingModes,
  type EntryAction,
} from "./primitives";

function Identity({ prefix = "" }: { prefix?: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 @[26rem]:grid-cols-2">
      <Field label="Nome">
        <Input
          name={`${prefix}first_name`}
          required={!prefix}
          autoComplete="off"
        />
      </Field>
      <Field label="Cognome">
        <Input name={`${prefix}last_name`} />
      </Field>
    </div>
  );
}
export function FamilyEntry({ action }: { action: EntryAction }) {
  return (
    <EntryForm
      action={action}
      className="p-5"
      submitLabel="Crea la famiglia e apri la scheda"
      successMessage="Famiglia creata."
      validate={(d) =>
        (d.get("parent_phone") || d.get("parent_last_name")) &&
        !d.get("parent_first_name")
          ? "Inserisci anche il nome del genitore, oppure lascia vuoti tutti i suoi dati."
          : (d.get("student_last_name") || d.get("school_level")) &&
              !d.get("student_first_name")
            ? "Inserisci anche il nome dello studente, oppure lascia vuoti tutti i suoi dati."
            : null
      }
    >
      <EntrySection
        title="1. La famiglia"
        description="Inizia dal nome con cui la cercherete nell’elenco."
      >
        <Field label="Nome della famiglia">
          <Input
            name="family_name"
            required
            placeholder="es. Famiglia Bianchi"
          />
        </Field>
      </EntrySection>
      <EntrySection
        title="2. Un genitore"
        description="Facoltativo. Puoi aggiungere altri contatti dalla scheda della famiglia."
      >
        <Identity prefix="parent_" />
        <Field label="Telefono WhatsApp del genitore">
          <Input
            name="parent_phone"
            type="tel"
            placeholder="es. +39 333 1234567"
          />
        </Field>
      </EntrySection>
      <EntrySection
        title="3. Un figlio o una figlia"
        description="Facoltativo. Se il cognome è vuoto, verrà usato quello del genitore."
      >
        <Identity prefix="student_" />
        <Field label="Classe o livello scolastico">
          <Input name="school_level" placeholder="es. 2ª media" />
        </Field>
      </EntrySection>
      <EntrySummary>
        Verrà creata una scheda famiglia con i dati compilati. Nessuna lezione o
        messaggio WhatsApp viene avviato da questo inserimento.
      </EntrySummary>
    </EntryForm>
  );
}
export function TutorEntry({ action }: { action: EntryAction }) {
  return (
    <EntryForm
      action={action}
      className="p-5"
      submitLabel="Crea tutor e completa la scheda"
      successMessage="Tutor creato."
      validate={(d) =>
        !d.getAll("modes").length
          ? "Scegli almeno una modalità: in presenza, online o entrambe."
          : null
      }
    >
      <EntrySection title="Chi è il nuovo tutor?">
        <Identity />
        <Field label="Telefono WhatsApp">
          <Input name="phone" type="tel" />
        </Field>
      </EntrySection>
      <TeachingModes />
      <EntrySection
        title="Compenso iniziale"
        description="Indica il compenso per una lezione individuale. Le altre tariffe si completano dalla scheda."
      >
        <Field
          label="Euro per un’ora"
          hint="Se lasci vuoto viene registrato 0 €. Potrai modificarlo nella scheda."
        >
          <Input
            name="hourly_rate"
            inputMode="decimal"
            pattern="[0-9]+([,.][0-9]{1,2})?"
            placeholder="es. 12,50"
          />
        </Field>
      </EntrySection>
      <EntrySummary>
        Dopo la creazione aggiungi materie insegnate e disponibilità: servono
        per collocare il tutor nelle nuove bozze.
      </EntrySummary>
    </EntryForm>
  );
}
export function StudentEntry({
  action,
  familyId,
}: {
  action: EntryAction;
  familyId: string;
}) {
  return (
    <EntryForm
      action={action}
      className="p-5"
      submitLabel="Aggiungi alla famiglia"
      successMessage="Studente aggiunto alla famiglia."
    >
      <input type="hidden" name="family_id" value={familyId} />
      <EntrySection
        title="Dati dello studente"
        description="La richiesta di lezioni si inserisce poi dalla sua scheda."
      >
        <Identity />
        <Field label="Classe o livello scolastico">
          <Input name="school_level" placeholder="es. 1ª liceo" />
        </Field>
        <Field
          label="Telefono dello studente"
          hint="Facoltativo. Le autorizzazioni al contatto diretto si gestiscono nei consensi della famiglia."
        >
          <Input name="phone" type="tel" />
        </Field>
      </EntrySection>
    </EntryForm>
  );
}
export function ParentEntry({
  action,
  familyId,
}: {
  action: EntryAction;
  familyId: string;
}) {
  return (
    <EntryForm
      action={action}
      className="border-t p-5"
      submitLabel="Aggiungi genitore"
      successMessage="Contatto aggiunto alla famiglia."
    >
      <input type="hidden" name="family_id" value={familyId} />
      <EntrySection title="Un altro contatto per la famiglia">
        <Identity />
        <Field label="Telefono WhatsApp">
          <Input name="phone" type="tel" />
        </Field>
        <Field label="Email" hint="Facoltativa.">
          <Input name="email" type="email" />
        </Field>
      </EntrySection>
      <EntrySummary>
        Il contatto verrà associato a questa famiglia. L’inserimento non invia
        messaggi.
      </EntrySummary>
    </EntryForm>
  );
}

export function SubjectAssignmentEntry({
  action,
  tutorId,
  subjects,
}: {
  action: EntryAction;
  tutorId: string;
  subjects: { id: string; name: string }[];
}) {
  return (
    <EntryForm
      action={action}
      className="border-t p-5"
      submitLabel="Associa materia al tutor"
      successMessage="Materia associata al tutor."
    >
      <input type="hidden" name="tutor_id" value={tutorId} />
      <EntrySection
        title="Cosa può insegnare?"
        description="Questa associazione permette al motore di assegnare il tutor alle richieste della materia."
      >
        <Field label="Materia">
          <Select name="subject_id" defaultValue="" required>
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
          label="Livelli scolastici"
          hint="Facoltativi, separati da virgola. Se lasci vuoto, non vengono applicati limiti di livello."
        >
          <Input name="levels" placeholder="es. media, liceo" />
        </Field>
      </EntrySection>
    </EntryForm>
  );
}
