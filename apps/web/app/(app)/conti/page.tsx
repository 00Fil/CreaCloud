import { PaymentEntry } from "@/components/entries/payment";
import Link from "next/link";

import { addFamilyPayment, addTutorPayout } from "@/app/(app)/actions/people";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  LinkButton,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
} from "@/components/ui";
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

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const today = todayRome();
  const month = /^\d{4}-\d{2}/.test(sp.m ?? "")
    ? monthStart(`${sp.m!.slice(0, 7)}-01`)
    : monthStart(today);
  const view = sp.vista === "tutor" ? "tutor" : "famiglie";
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
  const href = (m: string, v = view) => `/conti?m=${m.slice(0, 7)}&vista=${v}`;

  return (
    <>
      <PageHeader
        eyebrow="Conti in contanti · IVA esclusa"
        title={`Conti di ${monthLabel(month)}`}
        action={
          <>
            <LinkButton
              href={href(addMonths(month, -1))}
              variant="outline"
              size="sm"
            >
              ← {monthLabel(addMonths(month, -1))}
            </LinkButton>
            <LinkButton
              href={href(addMonths(month, 1))}
              variant="outline"
              size="sm"
            >
              {monthLabel(addMonths(month, 1))} →
            </LinkButton>
          </>
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

      <div className="mb-4 flex gap-2">
        {(["famiglie", "tutor"] as const).map((v) => (
          <Link
            key={v}
            href={href(month, v)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold capitalize ${view === v ? "border-pervinca bg-pervinca/10 text-pervinca-strong" : "text-ink-soft hover:bg-ink/5"}`}
          >
            {v}
          </Link>
        ))}
      </div>

      {view === "famiglie" ? (
        <Card>
          <CardHeader title={`${activeFamilies.length} famiglie con lezioni`} />
          <Table>
            <thead>
              <tr>
                <Th>Famiglia</Th>
                <Th className="text-right">Ore</Th>
                <Th className="text-right">Maturato</Th>
                <Th className="text-right">Pagato</Th>
                <Th className="text-right">Da saldare</Th>
                <Th className="text-right">Stima mese</Th>
                <Th>Stato</Th>
                <Th>Registra contanti</Th>
              </tr>
            </thead>
            <tbody>
              {activeFamilies.map(({ family, statement: s }) => {
                const mins = s.lines.reduce(
                  (a, l) => a + l.maturato.minutes,
                  0,
                );
                const [label, tone] = STATE[s.stato];
                return (
                  <tr key={family.id}>
                    <Td>
                      <Link
                        href={`/persone/famiglia/${family.id}`}
                        className="font-medium hover:underline"
                      >
                        {family.name}
                      </Link>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {formatHours(mins)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {formatEuro(s.maturato)}
                    </Td>
                    <Td className="text-right tabular-nums text-ok">
                      {formatEuro(s.pagato)}
                    </Td>
                    <Td className="text-right font-semibold tabular-nums">
                      {formatEuro(Math.max(0, s.saldo))}
                    </Td>
                    <Td className="text-right tabular-nums text-muted">
                      {formatEuro(s.saldoStimato)}
                    </Td>
                    <Td>
                      <Badge tone={tone}>{label}</Badge>
                    </Td>
                    <Td>
                      <PayForm
                        action={addFamilyPayment}
                        idName="family_id"
                        id={family.id}
                        personName={family.name}
                        month={month}
                        today={today}
                        suggested={Math.max(0, s.saldo)}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={`${activeTutors.length} tutor con lezioni`}
            subtitle="Le annullate tardi si pagano al tutor, salvo «senza compenso»"
          />
          <Table>
            <thead>
              <tr>
                <Th>Tutor</Th>
                <Th className="text-right">Ore maturate</Th>
                <Th className="text-right">Ore previste</Th>
                <Th className="text-right">Compenso</Th>
                <Th className="text-right">Pagato</Th>
                <Th className="text-right">Da dare</Th>
                <Th>Stato</Th>
                <Th>Registra pagamento</Th>
              </tr>
            </thead>
            <tbody>
              {activeTutors.map(({ tutor, statement: s }) => {
                const [label, tone] = STATE[s.stato];
                return (
                  <tr key={tutor.id}>
                    <Td>
                      <Link
                        href={`/persone/tutor/${tutor.id}`}
                        className="font-medium hover:underline"
                      >
                        {tutor.first_name} {tutor.last_name}
                      </Link>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {formatHours(s.maturato.minutes)}
                    </Td>
                    <Td className="text-right tabular-nums text-muted">
                      {formatHours(s.previsto.minutes)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {formatEuro(s.maturato.cents)}
                    </Td>
                    <Td className="text-right tabular-nums text-ok">
                      {formatEuro(s.pagato)}
                    </Td>
                    <Td className="text-right font-semibold tabular-nums">
                      {formatEuro(Math.max(0, s.residuo))}
                    </Td>
                    <Td>
                      <Badge tone={tone}>{label}</Badge>
                    </Td>
                    <Td>
                      <PayForm
                        action={addTutorPayout}
                        idName="tutor_id"
                        id={tutor.id}
                        personName={`${tutor.first_name} ${tutor.last_name}`}
                        month={month}
                        today={today}
                        suggested={Math.max(0, s.residuo)}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}

function PayForm({
  action,
  idName,
  id,
  month,
  today,
  suggested,
  personName,
}: {
  action: (fd: FormData) => Promise<void>;
  idName: string;
  id: string;
  month: string;
  today: string;
  suggested: number;
  personName: string;
}) {
  return (
    <PaymentEntry
      compact
      action={action}
      idName={idName}
      id={id}
      month={month}
      today={today}
      suggested={suggested}
      personName={personName}
    />
  );
}
