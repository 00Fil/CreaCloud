"use client";
import { useState } from "react";
import { Field, Input } from "../ui";
import {
  EntryForm,
  EntrySection,
  EntrySummary,
  type EntryAction,
} from "./primitives";
export function PaymentEntry({
  action,
  idName,
  id,
  month,
  today,
  suggested = 0,
  personName,
}: {
  action: EntryAction;
  idName: string;
  id: string;
  month: string;
  today: string;
  suggested?: number;
  personName: string;
}) {
  const tutor = idName === "tutor_id";
  const content = (
    <EntryForm
      action={action}
      validate={(d) =>
        Number(String(d.get("amount")).replace(",", ".")) > 0
          ? null
          : "L’importo deve essere maggiore di zero."
      }
      className="border-t p-5"
      submitLabel={
        tutor
          ? "Registra il pagamento al tutor"
          : "Registra l’incasso dalla famiglia"
      }
      successMessage={
        tutor
          ? "Pagamento registrato nello storico."
          : "Incasso registrato nello storico."
      }
    >
      <input type="hidden" name={idName} value={id} />
      <input type="hidden" name="period_month" value={month} />
      <EntrySection
        title={tutor ? "Pagamento a un tutor" : "Incasso dalla famiglia"}
        description={`${personName} · Periodo ${new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(month))}`}
      >
        <PaymentAmount suggested={suggested} />
        <Field
          label={tutor ? "Quando è stato pagato?" : "Quando è stato ricevuto?"}
          hint="La data di oggi è proposta, ma puoi correggerla."
        >
          <Input name="paid_on" type="date" defaultValue={today} required />
        </Field>
        <Field label="Nota per lo storico" hint="Facoltativa.">
          <Input name="note" placeholder="es. Acconto lezioni del mese" />
        </Field>
      </EntrySection>
      <EntrySummary>
        Questa operazione registra un movimento in contanti già avvenuto. Non
        effettua un trasferimento di denaro.
      </EntrySummary>
    </EntryForm>
  );
  return content;
}
function PaymentAmount({ suggested }: { suggested: number }) {
  const [amount, setAmount] = useState("");
  return (
    <div className="space-y-2">
      <Field label="Importo effettivo (€)">
        <Input
          name="amount"
          required
          inputMode="decimal"
          pattern="[0-9]+([,.][0-9]{1,2})?"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="es. 50,00"
        />
      </Field>
      {suggested > 0 && (
        <button
          type="button"
          className="min-h-11 rounded-full border px-4 text-sm text-ink-soft"
          onClick={() =>
            setAmount((suggested / 100).toFixed(2).replace(".", ","))
          }
        >
          Usa il residuo di {(suggested / 100).toFixed(2).replace(".", ",")} €
        </button>
      )}
    </div>
  );
}
