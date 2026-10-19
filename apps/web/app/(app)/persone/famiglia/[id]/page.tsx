import { ConstraintEntry } from "@/components/entries/scheduling";
import { LessonRequestEntry } from "@/components/entries/lessons";
import { StudentEntry, ParentEntry } from "@/components/entries/people";
import { PaymentEntry } from "@/components/entries/payment";
import { BooleanChoice } from "@/components/entries/primitives";
import { Bot, MessageCircle, Plus, Trash2 } from "lucide-react";
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
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Empty,
  Field,
  Input,
  PageHeader,
  PriorityBadge,
  Select,
  Textarea,
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

const CATEGORIES = [
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
];

export default async function FamilyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  return (
    <>
      <PageHeader eyebrow="Famiglia" title={family.name}>
        <Link href="/persone" className="text-pervinca-strong hover:underline">
          ← Tutte le famiglie
        </Link>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          {(students ?? []).map((s) => {
            const cs = (constraints ?? []).filter((c) => c.student_id === s.id);
            const rs = (reqLinks ?? [])
              .filter((r) => r.student_id === s.id)
              .map(
                (r) =>
                  r.lesson_requests as unknown as {
                    id: string;
                    kind: string;
                    sessions_per_week: number;
                    duration_min: number;
                    mode: string;
                    status: string;
                    topic: string | null;
                    source: string;
                    subjects: { name: string } | null;
                  },
              )
              .filter(Boolean);
            const ls = lessons
              .filter((l) => l.student_ids.includes(s.id) && l.date >= today)
              .slice(0, 8);
            const chat = chatOf(null, s.id);
            return (
              <Card key={s.id}>
                <CardHeader
                  title={`${s.first_name} ${s.last_name}`}
                  subtitle={
                    [s.school_level, s.phone].filter(Boolean).join(" · ") ||
                    "Nessun telefono"
                  }
                  action={
                    chat && (
                      <Link
                        href={`/chat/${chat.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-pervinca-strong"
                      >
                        <MessageCircle className="size-4" /> chat
                      </Link>
                    )
                  }
                />
                <div className="grid gap-6 p-5 lg:grid-cols-2">
                  <section>
                    <p className="label-caps mb-2 text-muted">
                      Impegni e vincoli
                    </p>
                    {cs.length ? (
                      <ul className="flex flex-col gap-2">
                        {cs.map((c) => (
                          <li
                            key={c.id}
                            className="rounded-xl border p-3 text-sm"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <PriorityBadge priority={c.priority} />
                              {c.source === "ai" && (
                                <Badge tone="pervinca">
                                  <Bot className="size-3" /> da WhatsApp
                                </Badge>
                              )}
                              {!c.priority_confirmed && (
                                <Badge tone="warn">
                                  priorità da confermare
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1.5 font-medium">{c.label}</p>
                            <p className="text-xs text-muted">
                              {c.weekday !== null
                                ? `ogni ${WEEKDAYS[c.weekday]}`
                                : `il ${shortDate(c.date)}`}
                              {" · "}
                              {c.start_min === 0 && c.end_min === 1440
                                ? "tutto il giorno"
                                : `${hhmm(c.start_min)}–${hhmm(c.end_min)}`}
                              {c.valid_to &&
                                ` · fino al ${shortDate(c.valid_to)}`}
                            </p>
                            <form
                              action={updateConstraint}
                              className="mt-2 flex items-center gap-2"
                            >
                              <input type="hidden" name="id" value={c.id} />
                              <input
                                type="hidden"
                                name="family_id"
                                value={id}
                              />
                              <Select
                                name="priority"
                                defaultValue={c.priority}
                                className="w-auto py-1 text-xs"
                              >
                                {[1, 2, 3, 4].map((p) => (
                                  <option key={p} value={p}>
                                    P{p}
                                  </option>
                                ))}
                              </Select>
                              <Button size="sm" variant="outline">
                                Conferma
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                name="delete"
                                value="1"
                                aria-label="Elimina"
                              >
                                <Trash2 />
                              </Button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted">
                        Nessun impegno registrato.
                      </p>
                    )}
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-pervinca-strong">
                        + Aggiungi impegno
                      </summary>
                      <ConstraintEntry
                        action={addConstraint}
                        studentId={s.id}
                        familyId={id}
                        studentName={s.first_name}
                      />
                    </details>
                  </section>

                  <section>
                    <p className="label-caps mb-2 text-muted">
                      Lezioni richieste
                    </p>
                    {rs.length ? (
                      <ul className="flex flex-col gap-2">
                        {rs.map((r) => (
                          <li
                            key={r.id}
                            className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm"
                          >
                            <span className="font-medium">
                              {r.subjects?.name}
                            </span>
                            <span className="text-muted">
                              {r.kind === "singola"
                                ? "una tantum"
                                : `${r.sessions_per_week}×/sett.`}{" "}
                              · {formatHours(r.duration_min)} · {r.mode}
                            </span>
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
                            <form action={setRequestStatus} className="ml-auto">
                              <input type="hidden" name="id" value={r.id} />
                              <input
                                type="hidden"
                                name="family_id"
                                value={id}
                              />
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
                            </form>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted">Nessuna richiesta.</p>
                    )}
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-pervinca-strong">
                        + Aggiungi lezioni
                      </summary>
                      <LessonRequestEntry
                        action={addRequest}
                        studentId={s.id}
                        familyId={id}
                        studentName={s.first_name}
                        subjects={subjects ?? []}
                        tutors={tutors ?? []}
                      />
                    </details>

                    <p className="label-caps mb-2 mt-5 text-muted">
                      Prossime lezioni
                    </p>
                    {ls.length ? (
                      <ul className="flex flex-col gap-1 text-sm">
                        {ls.map((l) => (
                          <li key={l.id} className="flex gap-2">
                            <span className="w-28 shrink-0 tabular-nums text-ink-soft">
                              {shortDate(l.date)} {hhmm(l.start_min)}
                            </span>
                            <span className="truncate">
                              {l.subject} con {l.tutor_name}
                            </span>
                            {l.status.startsWith("annullata") && (
                              <Badge tone="danger">annullata</Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted">
                        Nessuna lezione in programma.
                      </p>
                    )}
                  </section>
                </div>
                <details className="border-t px-5 py-3">
                  <summary className="cursor-pointer text-xs font-semibold text-muted">
                    Modifica dati di {s.first_name}
                  </summary>
                  <form
                    action={upsertStudent}
                    className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"
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
                        placeholder="Classe"
                      />
                    </Field>
                    <Field label="Telefono">
                      <Input
                        name="phone"
                        defaultValue={s.phone ?? ""}
                        placeholder="Telefono"
                      />
                    </Field>
                    <Field label="Tariffa singola (€/ora)">
                      <Input
                        name="hourly_rate"
                        defaultValue={
                          s.hourly_rate_cents ? s.hourly_rate_cents / 100 : ""
                        }
                        placeholder={`€/ora (${rates.defaultHourly / 100})`}
                      />
                    </Field>
                    <Field label="Tariffa gruppo (€/ora)">
                      <Input
                        name="group_hourly_rate"
                        defaultValue={
                          s.group_hourly_rate_cents
                            ? s.group_hourly_rate_cents / 100
                            : ""
                        }
                        placeholder={`€/ora gruppo (${rates.defaultGroupHourly / 100})`}
                      />
                    </Field>
                    <Field label="Massimo di lezioni al giorno">
                      <Input
                        name="max_lessons_per_day"
                        defaultValue={s.max_lessons_per_day ?? ""}
                        placeholder="Max lezioni/giorno"
                      />
                    </Field>
                    <Button size="sm" variant="outline">
                      Salva
                    </Button>
                  </form>
                  <form action={deletePerson} className="mt-2">
                    <input type="hidden" name="table" value="students" />
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="family_id" value={id} />
                    <Button size="sm" variant="danger">
                      Disattiva studente
                    </Button>
                  </form>
                </details>
              </Card>
            );
          })}

          <Card>
            <CardHeader title="Aggiungi figlio/a" />
            <StudentEntry action={upsertStudent} familyId={id} />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title={`Conto di ${monthLabel(month)}`}
              subtitle="Contanti, IVA esclusa"
            />
            <div className="grid grid-cols-2 gap-4 p-5 text-sm">
              <div>
                <p className="label-caps text-muted">Maturato</p>
                <p className="mt-1 font-serif text-2xl">
                  {formatEuro(statement.maturato)}
                </p>
              </div>
              <div>
                <p className="label-caps text-muted">Pagato</p>
                <p className="mt-1 font-serif text-2xl text-ok">
                  {formatEuro(statement.pagato)}
                </p>
              </div>
              <div>
                <p className="label-caps text-muted">Da saldare ora</p>
                <p className="mt-1 font-serif text-2xl text-pesca-deep">
                  {formatEuro(Math.max(0, statement.saldo))}
                </p>
              </div>
              <div>
                <p className="label-caps text-muted">Stima fine mese</p>
                <p className="mt-1 font-serif text-2xl">
                  {formatEuro(statement.saldoStimato)}
                </p>
              </div>
            </div>
            <ul className="border-t px-5 py-3 text-sm">
              {statement.lines.map((line) => {
                const s = (students ?? []).find((x) => x.id === line.studentId);
                return (
                  <li
                    key={line.studentId}
                    className="flex justify-between py-1"
                  >
                    <span>
                      {s?.first_name} · {formatHours(line.maturato.minutes)}{" "}
                      svolte
                      {line.previsto.minutes
                        ? ` + ${formatHours(line.previsto.minutes)} previste`
                        : ""}
                      {line.annullate ? ` · ${line.annullate} annullate` : ""}
                    </span>
                    <span className="tabular-nums">
                      {formatEuro(line.maturato.cents)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <PaymentEntry
              action={addFamilyPayment}
              idName="family_id"
              id={id}
              month={month}
              today={today}
              personName={family.name}
              suggested={Math.max(0, statement.saldo)}
            />
            {(payments ?? []).length > 0 && (
              <ul className="border-t px-5 py-3 text-sm">
                {(payments ?? []).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 py-1"
                  >
                    <span className="text-ink-soft">
                      {shortDate(p.paid_on)}{" "}
                      {p.period_month && (
                        <Badge>{monthLabel(p.period_month)}</Badge>
                      )}{" "}
                      {p.note}
                    </span>
                    <span className="flex items-center gap-2 tabular-nums">
                      {formatEuro(p.amount_cents)}
                      <form action={removeRow}>
                        <input
                          type="hidden"
                          name="table"
                          value="family_payments"
                        />
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="path" value={path} />
                        <button
                          className="text-muted hover:text-danger"
                          aria-label="Elimina pagamento"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Genitori" />
            {(parents ?? []).length ? (
              <ul className="divide-y">
                {(parents ?? []).map((p) => {
                  const chat = chatOf(p.id, null);
                  return (
                    <li key={p.id} className="px-5 py-3">
                      <details>
                        <summary className="flex cursor-pointer items-center gap-2 text-sm">
                          <span className="font-semibold">
                            {p.first_name} {p.last_name}
                          </span>
                          <span className="text-muted">{p.phone}</span>
                          {chat && (
                            <Link
                              href={`/chat/${chat.id}`}
                              className="ml-auto text-pervinca-strong"
                              aria-label="Apri chat"
                            >
                              <MessageCircle className="size-4" />
                            </Link>
                          )}
                        </summary>
                        <form
                          action={upsertParent}
                          className="mt-3 grid grid-cols-2 gap-2 text-sm"
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
                            <Input
                              name="last_name"
                              defaultValue={p.last_name}
                            />
                          </Field>
                          <Field label="Telefono">
                            <Input
                              name="phone"
                              defaultValue={p.phone ?? ""}
                              placeholder="Telefono"
                            />
                          </Field>
                          <Field label="Email">
                            <Input
                              name="email"
                              defaultValue={p.email ?? ""}
                              placeholder="Email"
                            />
                          </Field>
                          <Button size="sm" variant="outline">
                            Salva
                          </Button>
                        </form>
                        <form action={deletePerson} className="mt-2">
                          <input type="hidden" name="table" value="parents" />
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="family_id" value={id} />
                          <Button size="sm" variant="danger">
                            Elimina
                          </Button>
                        </form>
                      </details>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>Nessun genitore.</Empty>
            )}
            <ParentEntry action={upsertParent} familyId={id} />
          </Card>

          <Card>
            <CardHeader title="Note e consensi" />
            <form
              action={updateFamily}
              className="flex flex-col gap-3 p-5 text-sm"
            >
              <input type="hidden" name="id" value={id} />
              <Field label="Nome">
                <Input name="name" defaultValue={family.name} required />
              </Field>
              <Field label="Note">
                <Textarea name="notes" defaultValue={family.notes} />
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
              <Button size="sm" variant="outline">
                Salva
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
