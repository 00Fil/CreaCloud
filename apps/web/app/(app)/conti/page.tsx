import { PaymentEntry } from "@/components/entries/payment";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";

import { addFamilyPayment, addTutorPayout } from "@/app/(app)/actions/people";
import { DataTable, type Row } from "@/components/kit/data-table";
import { Sheet } from "@/components/kit/sheet";
import { Tabs } from "@/components/kit/tabs";
import { Badge, LinkButton, PageHeader, Stat } from "@/components/ui";
import { monthStatements } from "@/lib/billing/load";
import { sessionClient } from "@/lib/db/clients";
import {
  formatEuro,
  formatHours,
  type PaymentState,
} from "@/lib/domain/billing";
import {
  addMonths,
  monthLabel,
  monthStart,
  todayRome,
} from "@/lib/domain/time";

const STATE: Record<
  PaymentState,
  [string, "ok" | "warn" | "danger" | "neutral" | "pervinca"]
> = {
  saldato: ["saldato", "ok"],
  parziale: ["in parte", "warn"],
  da_pagare: ["da pagare", "danger"],
  in_credito: ["in anticipo", "pervinca"],
  nulla: ["—", "neutral"],
};
const FILTERS = [
  { value: "da_pagare", label: "Da pagare" },
  { value: "parziale", label: "In parte" },
  { value: "saldato", label: "Saldati" },
];

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; vista?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const today = todayRome();
  const month = /^\d{4}-\d{2}/.test(sp.m ?? "")
    ? monthStart(`${sp.m!.slice(0, 7)}-01`)
    : monthStart(today);
  const db = await sessionClient();
  const { families, tutors } = await monthStatements(db, month);
  const activeFamilies = families.filter(
    (f) => f.statement.maturato || f.statement.previsto || f.statement.pagato,
  );
  const activeTutors = tutors.filter(
    (t) =>
      t.statement.maturato.minutes ||
      t.statement.previsto.minutes ||
      t.statement.pagato,
  );

  const famDue = activeFamilies.reduce(
    (a, f) => a + Math.max(0, f.statement.saldo),
    0,
  );
  const famPaid = activeFamilies.reduce((a, f) => a + f.statement.pagato, 0);
  const famTotal = activeFamilies.reduce((a, f) => a + f.statement.maturato, 0);
  const tutDue = activeTutors.reduce(
    (a, t) => a + Math.max(0, t.statement.residuo),
    0,
  );
  const tutTotal = activeTutors.reduce(
    (a, t) => a + t.statement.maturato.cents,
    0,
  );
  const tab = sp.tab ?? (sp.vista === "tutor" ? "tutor" : undefined);
  const href = (m: string) =>
    `/conti?m=${m.slice(0, 7)}${tab ? `&tab=${tab}` : ""}`;

  const pay = (
    kind: "famiglia" | "tutor",
    id: string,
    name: string,
    suggested: number,
    compact = false,
  ) => (
    <Sheet
      variant={suggested ? "primary" : "ghost"}
      size="sm"
      trigger={
        compact ? (
          <Wallet aria-hidden="true" />
        ) : (
          <>
            <Wallet aria-hidden="true" />{" "}
            {kind === "famiglia" ? "Incassa" : "Paga"}
          </>
        )
      }
      triggerLabel={
        compact
          ? `${kind === "famiglia" ? "Registra incasso da" : "Registra pagamento a"} ${name}`
          : undefined
      }
      title={
        kind === "famiglia"
          ? "Registra un incasso"
          : "Registra un pagamento al tutor"
      }
      description={`${name} · ${monthLabel(month)}${suggested ? ` · ${kind === "famiglia" ? "da saldare" : "da dare"} ${formatEuro(suggested)}` : ""}`}
    >
      <PaymentEntry
        action={kind === "famiglia" ? addFamilyPayment : addTutorPayout}
        idName={kind === "famiglia" ? "family_id" : "tutor_id"}
        id={id}
        month={month}
        today={today}
        suggested={suggested}
        personName={name}
      />
    </Sheet>
  );

  const familyRows: Row[] = activeFamilies.map(({ family, statement: s }) => {
    const mins = s.lines.reduce((a, l) => a + l.maturato.minutes, 0);
    const due = Math.max(0, s.saldo);
    const [label, tone] = STATE[s.stato];
    return {
      id: family.id,
      href: `/persone/famiglia/${family.id}?tab=conto`,
      search: family.name,
      filter: s.stato,
      sort: {
        name: family.name,
        hours: mins,
        maturato: s.maturato,
        due,
        stima: s.saldoStimato,
      },
      cells: {
        name: family.name,
        hours: formatHours(mins),
        maturato: formatEuro(s.maturato),
        paid: <span className="text-ok">{formatEuro(s.pagato)}</span>,
        due: <span className="font-semibold">{formatEuro(due)}</span>,
        stima: <span className="text-muted">{formatEuro(s.saldoStimato)}</span>,
        state: <Badge tone={tone}>{label}</Badge>,
        pay: pay("famiglia", family.id, family.name, due),
      },
      mobile: (
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{family.name}</span>
            <span className="text-xs text-muted">
              {formatHours(mins)} · pagato {formatEuro(s.pagato)}
            </span>
          </span>
          <span className="text-right">
            <span className="block font-semibold tabular-nums">
              {formatEuro(due)}
            </span>
            <Badge tone={tone}>{label}</Badge>
          </span>
        </span>
      ),
      action: pay("famiglia", family.id, family.name, due, true),
    };
  });

  const tutorRows: Row[] = activeTutors.map(({ tutor, statement: s }) => {
    const name = `${tutor.first_name} ${tutor.last_name}`.trim();
    const due = Math.max(0, s.residuo);
    const [label, tone] = STATE[s.stato];
    return {
      id: tutor.id,
      href: `/persone/tutor/${tutor.id}?tab=compenso`,
      search: name,
      filter: s.stato,
      sort: {
        name,
        hours: s.maturato.minutes,
        planned: s.previsto.minutes,
        pay: s.maturato.cents,
        due,
      },
      cells: {
        name,
        hours: formatHours(s.maturato.minutes),
        planned: (
          <span className="text-muted">{formatHours(s.previsto.minutes)}</span>
        ),
        pay: formatEuro(s.maturato.cents),
        paid: <span className="text-ok">{formatEuro(s.pagato)}</span>,
        due: <span className="font-semibold">{formatEuro(due)}</span>,
        state: <Badge tone={tone}>{label}</Badge>,
        action: pay("tutor", tutor.id, name, due),
      },
      mobile: (
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{name}</span>
            <span className="text-xs text-muted">
              {formatHours(s.maturato.minutes)} svolte ·{" "}
              {formatHours(s.previsto.minutes)} previste
            </span>
          </span>
          <span className="text-right">
            <span className="block font-semibold tabular-nums">
              {formatEuro(due)}
            </span>
            <Badge tone={tone}>{label}</Badge>
          </span>
        </span>
      ),
      action: pay("tutor", tutor.id, name, due, true),
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="Conti in contanti · IVA esclusa"
        title={`Conti di ${monthLabel(month)}`}
        action={
          <span className="flex gap-1">
            <LinkButton
              href={href(addMonths(month, -1))}
              variant="outline"
              size="sm"
              aria-label={`Mese precedente: ${monthLabel(addMonths(month, -1))}`}
            >
              <ChevronLeft />
            </LinkButton>
            <LinkButton
              href={href(monthStart(today))}
              variant="outline"
              size="sm"
            >
              Questo mese
            </LinkButton>
            <LinkButton
              href={href(addMonths(month, 1))}
              variant="outline"
              size="sm"
              aria-label={`Mese successivo: ${monthLabel(addMonths(month, 1))}`}
            >
              <ChevronRight />
            </LinkButton>
          </span>
        }
      >
        Maturato: lezioni svolte, annullate tardi e programmate già passate.
        Previsto: lezioni ancora da fare. Le annullate in tempo o senza compenso
        non contano.
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Maturato famiglie"
          value={formatEuro(famTotal)}
          tone="pervinca"
        />
        <Stat label="Incassato" value={formatEuro(famPaid)} />
        <Stat label="Da incassare" value={formatEuro(famDue)} tone="pesca" />
        <Stat
          label="Da dare ai tutor"
          value={formatEuro(tutDue)}
          hint={`su ${formatEuro(tutTotal)} maturati`}
          tone="warn"
        />
      </div>

      <Tabs
        initial={tab}
        items={[
          {
            id: "famiglie",
            label: "Famiglie",
            badge: activeFamilies.filter((f) => f.statement.saldo > 0).length,
            content: (
              <DataTable
                placeholder="Cerca una famiglia"
                filters={FILTERS}
                rows={familyRows}
                initialSort={{ key: "due", dir: -1 }}
                empty="Nessuna famiglia con lezioni in questo mese."
                columns={[
                  { key: "name", header: "Famiglia", sortable: true },
                  {
                    key: "hours",
                    header: "Ore",
                    align: "right",
                    sortable: true,
                  },
                  {
                    key: "maturato",
                    header: "Maturato",
                    align: "right",
                    sortable: true,
                  },
                  { key: "paid", header: "Pagato", align: "right" },
                  {
                    key: "due",
                    header: "Da saldare",
                    align: "right",
                    sortable: true,
                  },
                  {
                    key: "stima",
                    header: "Stima mese",
                    align: "right",
                    sortable: true,
                  },
                  { key: "state", header: "Stato" },
                  { key: "pay", header: "" },
                ]}
              />
            ),
          },
          {
            id: "tutor",
            label: "Tutor",
            badge: activeTutors.filter((t) => t.statement.residuo > 0).length,
            content: (
              <DataTable
                placeholder="Cerca un tutor"
                filters={FILTERS}
                rows={tutorRows}
                initialSort={{ key: "due", dir: -1 }}
                empty="Nessun tutor con lezioni in questo mese."
                columns={[
                  { key: "name", header: "Tutor", sortable: true },
                  {
                    key: "hours",
                    header: "Ore svolte",
                    align: "right",
                    sortable: true,
                  },
                  {
                    key: "planned",
                    header: "Ore previste",
                    align: "right",
                    sortable: true,
                  },
                  {
                    key: "pay",
                    header: "Compenso",
                    align: "right",
                    sortable: true,
                  },
                  { key: "paid", header: "Pagato", align: "right" },
                  {
                    key: "due",
                    header: "Da dare",
                    align: "right",
                    sortable: true,
                  },
                  { key: "state", header: "Stato" },
                  { key: "action", header: "" },
                ]}
              />
            ),
          },
        ]}
      />
      <p className="mt-4 text-xs text-muted">
        Le lezioni annullate tardi si pagano al tutor, salvo quelle segnate
        «senza compenso».
      </p>
    </>
  );
}
