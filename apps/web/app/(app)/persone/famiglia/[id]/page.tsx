import { ConstraintEntry } from "@/components/entries/scheduling";
import { LessonRequestEntry } from "@/components/entries/lessons";
import { StudentEntry, ParentEntry } from "@/components/entries/people";
import { PaymentEntry } from "@/components/entries/payment";
import { BooleanChoice } from "@/components/entries/primitives";
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  MessageCircle,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addConstraint,
  addFamilyPayment,
  addRequest,
  deletePerson,
  removeRow,
  setRequestStatus,
  updateConstraint,
  updateFamily,
  upsertParent,
  upsertStudent,
} from "@/app/(app)/actions/people";
import { Sheet } from "@/components/kit/sheet";
import { SheetForm } from "@/components/kit/sheet-form";
import { Tabs } from "@/components/kit/tabs";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Empty,
  Field,
  Input,
  PriorityBadge,
  Select,
  Textarea,
  cn,
} from "@/components/ui";
import { loadRates } from "@/lib/billing/load";
import { sessionClient } from "@/lib/db/clients";
import { LESSON_SELECT, toLessonInfo } from "@/lib/db/repo";
import {
  familyStatement,
  formatEuro,
  formatHours,
  type BillingLesson,
} from "@/lib/domain/billing";
import {
  addDays,
  hhmm,
  monthEnd,
  monthLabel,
  monthStart,
  shortDate,
  todayRome,
  WEEKDAYS,
} from "@/lib/domain/time";

type Request = {
  id: string;
  kind: string;
  sessions_per_week: number;
  duration_min: number;
  mode: string;
  status: string;
  topic: string | null;
  source: string;
  subjects: { name: string } | null;
};

export default async function FamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const db = await sessionClient();
  const { data: family } = await db
    .from("families")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!family) notFound();
  const today = todayRome();
  const month = monthStart(today);

  const [
    { data: parents },
    { data: students },
    { data: subjects },
    { data: tutors },
    { data: chats },
    rates,
  ] = await Promise.all([
    db
      .from("parents")
      .select("*")
      .eq("family_id", id)
      .order("is_primary", { ascending: false }),
    db
      .from("students")
      .select("*")
      .eq("family_id", id)
      .eq("active", true)
      .order("first_name"),
    db.from("subjects").select("id, name").order("name"),
    db
      .from("tutors")
      .select("id, first_name, last_name")
      .eq("active", true)
      .order("last_name"),
    db.from("chats").select("id, parent_id, student_id, mode"),
    loadRates(db),
  ]);
  const studentIds = (students ?? []).map((s) => s.id);
  const [
    { data: constraints },
    { data: reqLinks },
    lessonLinks,
    { data: payments },
  ] = await Promise.all([
    studentIds.length
      ? db
          .from("student_constraints")
          .select("*")
          .in("student_id", studentIds)
          .order("priority")
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? db
          .from("lesson_request_students")
          .select(
            "student_id, lesson_requests(id, kind, subject_id, sessions_per_week, duration_min, mode, status, topic, source, subjects(name))",
          )
          .in("student_id", studentIds)
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? db
          .from("lesson_students")
          .select("lesson_id")
          .in("student_id", studentIds)
      : Promise.resolve({ data: [] }),
    db
      .from("family_payments")
      .select("*")
      .eq("family_id", id)
      .order("paid_on", { ascending: false })
      .limit(24),
  ]);
  const lessonIds = [
    ...new Set((lessonLinks.data ?? []).map((l) => l.lesson_id)),
  ];
  const { data: lessonRows } = lessonIds.length
    ? await db
        .from("lessons")
        .select(LESSON_SELECT)
        .in("id", lessonIds)
        .gte("date", month)
        .lte("date", addDays(today, 31))
        .order("date")
        .order("start_min")
    : { data: [] };
  const lessons = (
    (lessonRows ?? []) as unknown as Parameters<typeof toLessonInfo>[0][]
  ).map(toLessonInfo);
  const monthLessons: BillingLesson[] = lessons
    .filter((l) => l.date <= monthEnd(today))
    .map((l) => ({
      id: l.id,
      date: l.date,
      startMin: l.start_min,
      endMin: l.end_min,
      status: l.status,
      tutorId: l.tutor_id,
      studentIds: l.student_ids,
    }));
  const statement = familyStatement(
    (students ?? []).map((s) => ({
      id: s.id,
      hourlyRateCents: s.hourly_rate_cents,
      groupHourlyRateCents: s.group_hourly_rate_cents,
    })),
    monthLessons,
    (payments ?? [])
      .filter((p) => p.period_month === month)
      .map((p) => p.amount_cents),
    rates,
    today,
  );
  const chatOf = (pid: string | null, sid: string | null) =>
    (chats ?? []).find(
      (c) => (pid && c.parent_id === pid) || (sid && c.student_id === sid),
    );
  const path = `/persone/famiglia/${id}`;
  const firstName = new Map((students ?? []).map((s) => [s.id, s.first_name]));
  const requestsOf = (sid: string) =>
    (reqLinks ?? [])
      .filter((r) => r.student_id === sid)
      .map((r) => r.lesson_requests as unknown as Request)
      .filter(Boolean);
  const weekly = (students ?? []).reduce(
    (a, s) =>
      a +
      requestsOf(s.id)
        .filter((r) => r.status === "attiva" && r.kind === "ricorrente")
        .reduce((b, r) => b + r.sessions_per_week, 0),
    0,
  );
  const unconfirmed = (constraints ?? []).filter((c) => !c.priority_confirmed);
  const due = Math.max(0, statement.saldo);
  const upcoming = lessons.filter((l) => l.date >= today);
  const past = lessons.filter((l) => l.date < today).reverse();

  const paymentSheet = (variant: "primary" | "outline") => (
    <Sheet
      variant={variant}
      trigger={
        <>
          <Wallet aria-hidden="true" /> Registra incasso
        </>
      }
      title="Registra un incasso"
      description={`${family.name} · ${monthLabel(month)}${due ? ` · da saldare ${formatEuro(due)}` : ""}`}
    >
      <PaymentEntry
        action={addFamilyPayment}
        idName="family_id"
        id={id}
        month={month}
        today={today}
        personName={family.name}
        suggested={due}
      />
    </Sheet>
  );

  // ------------------------------------------------------------ figli
  const childrenTab = (
    <div className="flex flex-col gap-5">
      {(students ?? []).map((s) => {
        const cs = (constraints ?? []).filter((c) => c.student_id === s.id);
        const rs = requestsOf(s.id);
        const next = upcoming.find((l) => l.student_ids.includes(s.id));
        const chat = chatOf(null, s.id);
        return (
          <Card key={s.id}>
            <CardHeader
              title={`${s.first_name} ${s.last_name}`}
              subtitle={
                <>
                  {[s.school_level, s.phone].filter(Boolean).join(" · ") ||
                    "Nessun telefono"}
                  {next && (
                    <span className="mt-1 flex items-center gap-1.5 text-ink-soft">
                      <CalendarClock aria-hidden="true" className="size-3.5" />
                      Prossima: {shortDate(next.date)} {hhmm(next.start_min)} ·{" "}
                      {next.subject}
                    </span>
                  )}
                </>
              }
              action={
                <div className="flex flex-wrap gap-2">
                  {chat && (
                    <Link
                      href={`/chat/${chat.id}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-pervinca-strong hover:bg-pervinca/10"
                    >
                      <MessageCircle aria-hidden="true" className="size-4" />{" "}
                      Chat
                    </Link>
                  )}
                  <Sheet
                    variant="ghost"
                    trigger={
                      <>
                        <Pencil aria-hidden="true" /> Modifica
                      </>
                    }
                    title={`Dati di ${s.first_name}`}
                    description="Anagrafica, tariffe e limiti per il calendario."
                  >
                    <SheetForm
                      action={upsertStudent}
                      success={`Dati di ${s.first_name} salvati`}
                      className="grid gap-4 sm:grid-cols-2"
                    >
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="family_id" value={id} />
                      <Field label="Nome">
                        <Input
                          name="first_name"
                          defaultValue={s.first_name}
                          required
                        />
                      </Field>
                      <Field label="Cognome">
                        <Input name="last_name" defaultValue={s.last_name} />
                      </Field>
                      <Field label="Classe o livello">
                        <Input
                          name="school_level"
                          defaultValue={s.school_level}
                          placeholder="Es. 2ª media"
                        />
                      </Field>
                      <Field label="Telefono">
                        <Input
                          name="phone"
                          type="tel"
                          defaultValue={s.phone ?? ""}
                        />
                      </Field>
                      <Field
                        label="Tariffa singola (€/ora)"
                        hint={`Vuoto: tariffa del centro (${rates.defaultHourly / 100} €)`}
                      >
                        <Input
                          name="hourly_rate"
                          inputMode="decimal"
                          defaultValue={
                            s.hourly_rate_cents ? s.hourly_rate_cents / 100 : ""
                          }
                        />
                      </Field>
                      <Field
                        label="Tariffa gruppo (€/ora)"
                        hint={`Vuoto: tariffa del centro (${rates.defaultGroupHourly / 100} €)`}
                      >
                        <Input
                          name="group_hourly_rate"
                          inputMode="decimal"
                          defaultValue={
                            s.group_hourly_rate_cents
                              ? s.group_hourly_rate_cents / 100
                              : ""
                          }
                        />
                      </Field>
                      <Field
                        label="Massimo di lezioni al giorno"
                        hint="Vuoto: nessun limite"
                      >
                        <Input
                          name="max_lessons_per_day"
                          inputMode="numeric"
                          defaultValue={s.max_lessons_per_day ?? ""}
                        />
                      </Field>
                      <div className="flex items-end sm:col-span-2">
                        <Button variant="primary">Salva</Button>
                      </div>
                    </SheetForm>
                    <SheetForm
                      action={deletePerson}
                      success={`${s.first_name} disattivato`}
                      className="mt-8 rounded-2xl border border-danger/20 p-4"
                    >
                      <input type="hidden" name="table" value="students" />
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="family_id" value={id} />
                      <p className="text-sm font-semibold">
                        Disattiva studente
                      </p>
                      <p className="mb-3 mt-1 text-xs text-muted">
                        Non verrà più pianificato. Lezioni passate e conti
                        restano nello storico.
                      </p>
                      <Button
                        size="sm"
                        variant="danger"
                        confirmMessage={`Disattivare ${s.first_name}? Non riceverà più lezioni nei nuovi piani.`}
                        confirmLabel="Disattiva"
                      >
                        Disattiva {s.first_name}
                      </Button>
                    </SheetForm>
                  </Sheet>
                </div>
              }
            />
            <div className="grid divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              <section
                className="p-5"
                aria-label={`Lezioni di ${s.first_name}`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="label-caps font-sans text-muted">
                    Lezioni richieste
                  </h3>
                  <Sheet
                    variant="ghost"
                    trigger={
                      <>
                        <Plus aria-hidden="true" /> Lezioni
                      </>
                    }
                    title={`Nuove lezioni per ${s.first_name}`}
                    description="Il motore le inserirà nel prossimo piano."
                    wide
                  >
                    <LessonRequestEntry
                      action={addRequest}
                      studentId={s.id}
                      familyId={id}
                      studentName={s.first_name}
                      subjects={subjects ?? []}
                      tutors={tutors ?? []}
                    />
                  </Sheet>
                </div>
                {rs.length ? (
                  <ul className="flex flex-col gap-2">
                    {rs.map((r) => (
                      <li
                        key={r.id}
                        className={cn(
                          "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-sm",
                          r.status !== "attiva" && "bg-surface-2/60",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {r.subjects?.name}
                            {r.topic && (
                              <span className="font-normal text-muted">
                                {" "}
                                · {r.topic}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted">
                            {r.kind === "singola"
                              ? "una tantum"
                              : `${r.sessions_per_week}× a settimana`}{" "}
                            · {formatHours(r.duration_min)} · {r.mode}
                          </p>
                        </div>
                        <Badge
                          tone={
                            r.status === "attiva"
                              ? "ok"
                              : r.status === "da_approvare"
                                ? "warn"
                                : "neutral"
                          }
                        >
                          {r.status.replace("_", " ")}
                        </Badge>
                        <SheetForm
                          action={setRequestStatus}
                          success={
                            r.status === "attiva"
                              ? "Richiesta sospesa"
                              : "Richiesta attivata"
                          }
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="family_id" value={id} />
                          {r.status === "attiva" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              name="status"
                              value="sospesa"
                            >
                              Sospendi
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              name="status"
                              value="attiva"
                            >
                              Attiva
                            </Button>
                          )}
                        </SheetForm>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted">
                    Nessuna lezione richiesta.
                  </p>
                )}
              </section>

              <section
                className="p-5"
                aria-label={`Impegni di ${s.first_name}`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="label-caps font-sans text-muted">
                    Impegni e vincoli
                  </h3>
                  <Sheet
                    variant="ghost"
                    trigger={
                      <>
                        <Plus aria-hidden="true" /> Impegno
                      </>
                    }
                    title={`Impegno di ${s.first_name}`}
                    description="Orari in cui non può fare lezione, con la loro importanza."
                    wide
                  >
                    <ConstraintEntry
                      action={addConstraint}
                      studentId={s.id}
                      familyId={id}
                      studentName={s.first_name}
                    />
                  </Sheet>
                </div>
                {cs.length ? (
                  <ul className="flex flex-col gap-2">
                    {cs.map((c) => (
                      <li
                        key={c.id}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-sm",
                          !c.priority_confirmed && "border-warn/40 bg-warn/5",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 flex-1 font-semibold">
                            {c.label}
                          </p>
                          <PriorityBadge priority={c.priority} />
                          {c.source === "ai" && (
                            <Badge tone="pervinca">
                              <Bot aria-hidden="true" className="size-3" /> da
                              WhatsApp
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted">
                          {c.weekday !== null
                            ? `ogni ${WEEKDAYS[c.weekday]}`
                            : `il ${shortDate(c.date)}`}
                          {" · "}
                          {c.start_min === 0 && c.end_min === 1440
                            ? "tutto il giorno"
                            : `${hhmm(c.start_min)}–${hhmm(c.end_min)}`}
                          {c.valid_to && ` · fino al ${shortDate(c.valid_to)}`}
                        </p>
                        <SheetForm
                          action={updateConstraint}
                          success="Impegno aggiornato"
                          className="mt-2 flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="family_id" value={id} />
                          <label className="sr-only" htmlFor={`p-${c.id}`}>
                            Priorità di {c.label}
                          </label>
                          <Select
                            id={`p-${c.id}`}
                            name="priority"
                            defaultValue={c.priority}
                            className="w-auto py-1"
                          >
                            {[1, 2, 3, 4].map((p) => (
                              <option key={p} value={p}>
                                P{p}
                              </option>
                            ))}
                          </Select>
                          <Button
                            size="sm"
                            variant={
                              c.priority_confirmed ? "outline" : "accent"
                            }
                          >
                            {c.priority_confirmed
                              ? "Aggiorna"
                              : "Conferma priorità"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            name="delete"
                            value="1"
                            aria-label={`Elimina impegno ${c.label}`}
                            confirmMessage={`Eliminare l’impegno “${c.label}”?`}
                            confirmLabel="Elimina"
                            className="ml-auto"
                          >
                            <Trash2 />
                          </Button>
                        </SheetForm>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted">
                    Nessun impegno: è disponibile in tutti gli orari del centro.
                  </p>
                )}
              </section>
            </div>
          </Card>
        );
      })}
      {!(students ?? []).length && (
        <Card>
          <Empty>
            Nessun figlio registrato. Aggiungilo per pianificare le lezioni.
          </Empty>
        </Card>
      )}
    </div>
  );

  // ------------------------------------------------------------ lezioni
  const lessonList = (list: typeof lessons, emptyText: string) =>
    list.length ? (
      <ul className="divide-y">
        {list.map((l) => {
          const cancelled = l.status.startsWith("annullata");
          return (
            <li key={l.id}>
              <Link
                href={`/calendario?giorno=${l.date}&lezione=${l.id}`}
                className="flex items-center gap-4 px-5 py-3 text-sm hover:bg-ink/[0.03]"
              >
                <span className="w-24 shrink-0">
                  <span className="block font-semibold capitalize">
                    {shortDate(l.date)}
                  </span>
                  <span className="tabular-nums text-muted">
                    {hhmm(l.start_min)}–{hhmm(l.end_min)}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate font-medium",
                      cancelled && "line-through opacity-60",
                    )}
                  >
                    {l.subject} con {l.tutor_name}
                  </span>
                  <span className="text-xs text-muted">
                    {l.student_ids
                      .map((x) => firstName.get(x))
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </span>
                {cancelled && <Badge tone="danger">annullata</Badge>}
                {l.status === "svolta" && <Badge tone="ok">svolta</Badge>}
              </Link>
            </li>
          );
        })}
      </ul>
    ) : (
      <Empty>{emptyText}</Empty>
    );
  const lessonsTab = (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="In programma" subtitle="Prossimi 31 giorni" />
        {lessonList(upcoming, "Nessuna lezione in programma.")}
      </Card>
      <Card>
        <CardHeader title="Già fatte" subtitle={monthLabel(month)} />
        {lessonList(past, "Nessuna lezione questo mese.")}
      </Card>
    </div>
  );

  // ------------------------------------------------------------ conto
  const accountTab = (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader
          title={`Conto di ${monthLabel(month)}`}
          subtitle="Contanti, IVA esclusa"
          action={paymentSheet("primary")}
        />
        <dl className="grid grid-cols-2 gap-4 p-5 text-sm">
          {[
            ["Maturato", formatEuro(statement.maturato), ""],
            ["Pagato", formatEuro(statement.pagato), "text-ok"],
            ["Da saldare ora", formatEuro(due), "text-pesca-deep"],
            ["Stima fine mese", formatEuro(statement.saldoStimato), ""],
          ].map(([label, value, tone]) => (
            <div key={label}>
              <dt className="label-caps text-muted">{label}</dt>
              <dd className={cn("mt-1 font-serif text-2xl", tone)}>{value}</dd>
            </div>
          ))}
        </dl>
        <ul className="border-t px-5 py-3 text-sm">
          {statement.lines.map((line) => (
            <li
              key={line.studentId}
              className="flex justify-between gap-3 py-1.5"
            >
              <span>
                <span className="font-semibold">
                  {firstName.get(line.studentId)}
                </span>{" "}
                <span className="text-muted">
                  {formatHours(line.maturato.minutes)} svolte
                  {line.previsto.minutes
                    ? ` + ${formatHours(line.previsto.minutes)} previste`
                    : ""}
                  {line.annullate ? ` · ${line.annullate} annullate` : ""}
                </span>
              </span>
              <span className="tabular-nums">
                {formatEuro(line.maturato.cents)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Incassi registrati" subtitle="Ultimi 24" />
        {(payments ?? []).length ? (
          <ul className="divide-y text-sm">
            {(payments ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-2">
                <span className="w-16 shrink-0 text-ink-soft">
                  {shortDate(p.paid_on)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {p.period_month && (
                    <Badge className="mr-1.5">
                      {monthLabel(p.period_month)}
                    </Badge>
                  )}
                  <span className="text-muted">{p.note}</span>
                </span>
                <span className="font-semibold tabular-nums">
                  {formatEuro(p.amount_cents)}
                </span>
                <SheetForm action={removeRow} success="Incasso eliminato">
                  <input type="hidden" name="table" value="family_payments" />
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="path" value={path} />
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Elimina incasso del ${shortDate(p.paid_on)}`}
                    confirmMessage={`Eliminare l’incasso di ${formatEuro(p.amount_cents)} del ${shortDate(p.paid_on)}?`}
                    confirmLabel="Elimina"
                  >
                    <Trash2 />
                  </Button>
                </SheetForm>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nessun incasso registrato.</Empty>
        )}
      </Card>
    </div>
  );

  // ------------------------------------------------------------ contatti
  const familySheet = (
    <Sheet
      variant="ghost"
      trigger={
        <>
          <Pencil aria-hidden="true" /> Modifica
        </>
      }
      title="Dati della famiglia"
      description="Nome, note interne e consensi."
    >
      <SheetForm
        action={updateFamily}
        success="Famiglia aggiornata"
        className="flex flex-col gap-5"
      >
        <input type="hidden" name="id" value={id} />
        <Field label="Nome">
          <Input name="name" defaultValue={family.name} required />
        </Field>
        <Field label="Note" hint="Visibili solo allo staff.">
          <Textarea name="notes" defaultValue={family.notes} rows={4} />
        </Field>
        <BooleanChoice
          name="privacy_consent"
          label="Informativa privacy della famiglia"
          initial={Boolean(family.privacy_consent_at)}
          positive="Firma registrata"
          positiveHint="Conferma solo se l’informativa è stata effettivamente firmata."
          negative="Firma non registrata"
        />
        <BooleanChoice
          name="minors_contact_consent"
          label="Contatto diretto con i figli"
          initial={family.minors_contact_consent}
          positive="Autorizzato"
          positiveHint="I figli possono scrivere direttamente al centro."
          negative="Non autorizzato"
          negativeHint="Mantieni i genitori come riferimento per il contatto."
        />
        <div>
          <Button variant="primary">Salva</Button>
        </div>
      </SheetForm>
    </Sheet>
  );
  const contactsTab = (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader
          title="Genitori"
          action={
            <Sheet
              variant="ghost"
              trigger={
                <>
                  <Plus aria-hidden="true" /> Genitore
                </>
              }
              title="Aggiungi un genitore"
              description={family.name}
            >
              <ParentEntry action={upsertParent} familyId={id} />
            </Sheet>
          }
        />
        {(parents ?? []).length ? (
          <ul className="divide-y">
            {(parents ?? []).map((p) => {
              const chat = chatOf(p.id, null);
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {p.first_name} {p.last_name}
                      {p.is_primary && (
                        <Badge tone="pervinca" className="ml-2">
                          referente
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted">
                      {[p.phone, p.email].filter(Boolean).join(" · ") ||
                        "Nessun contatto"}
                    </p>
                  </div>
                  {chat && (
                    <Link
                      href={`/chat/${chat.id}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-pervinca-strong hover:bg-pervinca/10"
                    >
                      <MessageCircle aria-hidden="true" className="size-4" />{" "}
                      Chat
                    </Link>
                  )}
                  <Sheet
                    variant="ghost"
                    trigger={<Pencil aria-hidden="true" />}
                    triggerLabel={`Modifica ${p.first_name}`}
                    title={`${p.first_name} ${p.last_name}`}
                    description="Contatti del genitore."
                  >
                    <SheetForm
                      action={upsertParent}
                      success="Genitore aggiornato"
                      className="grid gap-4 sm:grid-cols-2"
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="family_id" value={id} />
                      <Field label="Nome">
                        <Input
                          name="first_name"
                          defaultValue={p.first_name}
                          required
                        />
                      </Field>
                      <Field label="Cognome">
                        <Input name="last_name" defaultValue={p.last_name} />
                      </Field>
                      <Field label="Telefono">
                        <Input
                          name="phone"
                          type="tel"
                          defaultValue={p.phone ?? ""}
                        />
                      </Field>
                      <Field label="Email">
                        <Input
                          name="email"
                          type="email"
                          defaultValue={p.email ?? ""}
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <Button variant="primary">Salva</Button>
                      </div>
                    </SheetForm>
                    <SheetForm
                      action={deletePerson}
                      success="Genitore eliminato"
                      className="mt-8 rounded-2xl border border-danger/20 p-4"
                    >
                      <input type="hidden" name="table" value="parents" />
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="family_id" value={id} />
                      <p className="mb-3 text-sm font-semibold">
                        Elimina genitore
                      </p>
                      <Button
                        size="sm"
                        variant="danger"
                        confirmMessage={`Eliminare ${p.first_name} ${p.last_name}?`}
                        confirmLabel="Elimina"
                      >
                        Elimina {p.first_name}
                      </Button>
                    </SheetForm>
                  </Sheet>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>Nessun genitore.</Empty>
        )}
      </Card>
      <Card>
        <CardHeader title="Note e consensi" action={familySheet} />
        <div className="flex flex-col gap-3 p-5 text-sm">
          <p className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-4 text-muted" />
            Privacy:{" "}
            {family.privacy_consent_at ? (
              <Badge tone="ok">firmata</Badge>
            ) : (
              <Badge tone="warn">da firmare</Badge>
            )}
          </p>
          <p className="flex items-center gap-2">
            <MessageCircle aria-hidden="true" className="size-4 text-muted" />
            Contatto con i figli:{" "}
            {family.minors_contact_consent ? (
              <Badge tone="ok">autorizzato</Badge>
            ) : (
              <Badge>solo genitori</Badge>
            )}
          </p>
          <p className="whitespace-pre-line rounded-xl bg-surface-2 p-3 text-ink-soft">
            {family.notes || "Nessuna nota."}
          </p>
        </div>
      </Card>
    </div>
  );

  return (
    <>
      <Link
        href="/persone"
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-pervinca-strong hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Famiglie
      </Link>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label-caps mb-1.5 text-pesca">Famiglia</p>
          <h1 className="text-3xl leading-tight sm:text-4xl">{family.name}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {(parents ?? [])
              .map((p) => `${p.first_name} ${p.last_name}`.trim())
              .join(", ") || "Nessun genitore"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {paymentSheet("primary")}
          <Sheet
            trigger={
              <>
                <Plus aria-hidden="true" /> Figlio/a
              </>
            }
            title="Aggiungi figlio/a"
            description={family.name}
          >
            <StudentEntry action={upsertStudent} familyId={id} />
          </Sheet>
        </div>
      </header>

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Figli", String((students ?? []).length), null],
          ["Lezioni a settimana", String(weekly), null],
          ["Da saldare", formatEuro(due), due ? "text-pesca-deep" : null],
          [
            "Priorità da confermare",
            String(unconfirmed.length),
            unconfirmed.length ? "text-warn" : null,
          ],
        ].map(([label, value, tone]) => (
          <Card key={label} className="px-4 py-3">
            <dt className="label-caps text-muted">{label}</dt>
            <dd className={cn("mt-1 font-serif text-2xl", tone)}>{value}</dd>
          </Card>
        ))}
      </dl>

      <Tabs
        initial={tab}
        items={[
          {
            id: "figli",
            label: "Figli",
            badge: unconfirmed.length || undefined,
            content: childrenTab,
          },
          {
            id: "lezioni",
            label: "Lezioni",
            badge: upcoming.length,
            content: lessonsTab,
          },
          { id: "conto", label: "Conto", content: accountTab },
          {
            id: "contatti",
            label: "Contatti e consensi",
            content: contactsTab,
          },
        ]}
      />
    </>
  );
}
