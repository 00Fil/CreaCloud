import { SubjectAssignmentEntry } from "@/components/entries/people";
import { HoursEntry, AbsenceEntry } from "@/components/entries/scheduling";
import { TeachingModes } from "@/components/entries/primitives";
import { PaymentEntry } from "@/components/entries/payment";
import { Bot, MessageCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addAbsence,
  addAvailability,
  addTutorPayout,
  removeRow,
  setTutorSubject,
  upsertTutor,
} from "@/app/(app)/actions/people";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import { loadRates } from "@/lib/billing/load";
import { sessionClient } from "@/lib/db/clients";
import { LESSON_SELECT, toLessonInfo } from "@/lib/db/repo";
import {
  formatEuro,
  formatHours,
  tutorStatement,
  type BillingLesson,
} from "@/lib/domain/billing";
import { STATUS_LABEL } from "@/lib/domain/cancellation";
import {
  addDays,
  hhmm,
  monthEnd,
  monthLabel,
  monthStart,
  shortDate,
  todayRome,
  WEEKDAYS,
  WEEKDAYS_SHORT,
} from "@/lib/domain/time";

const STATE_LABEL = {
  saldato: "pagato",
  parziale: "pagato in parte",
  da_pagare: "da pagare",
  in_credito: "pagato in anticipo",
  nulla: "nessuna ora",
} as const;

export default async function TutorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await sessionClient();
  const { data: tutor } = await db
    .from("tutors")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!tutor) notFound();
  const today = todayRome();
  const month = monthStart(today);
  const path = `/persone/tutor/${id}`;

  const [
    { data: subjects },
    { data: links },
    { data: availability },
    { data: absences },
    { data: lessonRows },
    { data: payouts },
    { data: chat },
    rates,
  ] = await Promise.all([
    db.from("subjects").select("id, name").order("name"),
    db.from("tutor_subjects").select("subject_id, levels").eq("tutor_id", id),
    db
      .from("tutor_availability")
      .select("*")
      .eq("tutor_id", id)
      .order("weekday")
      .order("start_min"),
    db
      .from("tutor_absences")
      .select("*")
      .eq("tutor_id", id)
      .gte("date", today)
      .order("date"),
    db
      .from("lessons")
      .select(LESSON_SELECT)
      .eq("tutor_id", id)
      .gte("date", month)
      .lte("date", addDays(today, 31))
      .order("date")
      .order("start_min"),
    db
      .from("tutor_payouts")
      .select("*")
      .eq("tutor_id", id)
      .order("paid_on", { ascending: false })
      .limit(24),
    db.from("chats").select("id").eq("tutor_id", id).maybeSingle(),
    loadRates(db),
  ]);
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
  const st = tutorStatement(
    {
      id,
      hourlyRateCents: tutor.hourly_rate_cents,
      groupHourlyRateCents: tutor.group_hourly_rate_cents,
    },
    monthLessons,
    (payouts ?? [])
      .filter((p) => p.period_month === month)
      .map((p) => p.amount_cents),
    rates,
    today,
  );
  const subjectName = new Map((subjects ?? []).map((s) => [s.id, s.name]));
  const linked = new Set((links ?? []).map((l) => l.subject_id));
  const upcoming = lessons.filter((l) => l.date >= today).slice(0, 15);
  const weeklyMinutes = (availability ?? []).reduce(
    (a, w) => a + (w.end_min - w.start_min),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="Tutor"
        title={`${tutor.first_name} ${tutor.last_name}`.trim()}
      >
        <span className="flex flex-wrap items-center gap-3">
          <Link
            href="/persone?tab=tutor"
            className="text-pervinca-strong hover:underline"
          >
            ← Tutti i tutor
          </Link>
          {tutor.phone && <span>{tutor.phone}</span>}
          {chat && (
            <Link
              href={`/chat/${chat.id}`}
              className="inline-flex items-center gap-1 font-semibold text-pervinca-strong"
            >
              <MessageCircle className="size-4" /> chat
            </Link>
          )}
          {!tutor.active && <Badge tone="warn">non attivo</Badge>}
        </span>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title="Disponibilità settimanale"
              subtitle={`${formatHours(weeklyMinutes)} a settimana in totale`}
            />
            <div className="grid grid-cols-7 gap-1 p-5 text-center text-xs">
              {WEEKDAYS_SHORT.map((d, i) => (
                <div key={d} className="flex flex-col gap-1">
                  <span className="label-caps text-muted">{d}</span>
                  {(availability ?? [])
                    .filter((w) => w.weekday === i)
                    .map((w) => (
                      <form
                        key={w.id}
                        action={removeRow}
                        className="group relative rounded-lg bg-pervinca/15 px-1 py-1.5 tabular-nums"
                      >
                        <input
                          type="hidden"
                          name="table"
                          value="tutor_availability"
                        />
                        <input type="hidden" name="id" value={w.id} />
                        <input type="hidden" name="path" value={path} />
                        {hhmm(w.start_min)}
                        <br />
                        {hhmm(w.end_min)}
                        {w.source === "ai" && (
                          <Bot className="mx-auto mt-0.5 size-3 text-pervinca" />
                        )}
                        <button
                          className="absolute -right-1 -top-1 hidden rounded-full bg-surface p-0.5 text-danger shadow group-hover:block"
                          aria-label="Rimuovi fascia"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </form>
                    ))}
                </div>
              ))}
            </div>
            <HoursEntry action={addAvailability} tutorId={id} />
          </Card>

          <Card>
            <CardHeader
              title="Assenze in arrivo"
              subtitle="Il motore non colloca lezioni in questi momenti"
            />
            {(absences ?? []).length ? (
              <ul className="divide-y text-sm">
                {(absences ?? []).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 px-5 py-2.5"
                  >
                    <span className="w-32 tabular-nums">
                      {shortDate(a.date)}
                    </span>
                    <span className="text-ink-soft">
                      {a.start_min === 0 && a.end_min === 1440
                        ? "tutto il giorno"
                        : `${hhmm(a.start_min)}–${hhmm(a.end_min)}`}
                    </span>
                    <span className="flex-1 truncate text-muted">{a.note}</span>
                    {a.source === "ai" && (
                      <Badge tone="pervinca">da WhatsApp</Badge>
                    )}
                    <form action={removeRow}>
                      <input
                        type="hidden"
                        name="table"
                        value="tutor_absences"
                      />
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="path" value={path} />
                      <button
                        className="text-muted hover:text-danger"
                        aria-label="Elimina assenza"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">
                Nessuna assenza registrata.
              </p>
            )}
            <AbsenceEntry action={addAbsence} tutorId={id} />
          </Card>

          <Card>
            <CardHeader title="Prossime lezioni" />
            {upcoming.length ? (
              <ul className="divide-y text-sm">
                {upcoming.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5"
                  >
                    <span className="w-36 tabular-nums text-ink-soft">
                      {shortDate(l.date)} {hhmm(l.start_min)}–{hhmm(l.end_min)}
                    </span>
                    <span className="flex-1">
                      {l.subject} · {l.student_names.join(", ")}
                    </span>
                    {l.mode === "online" && <Badge>online</Badge>}
                    {l.student_ids.length > 1 && (
                      <Badge tone="pervinca">gruppo</Badge>
                    )}
                    {l.status !== "programmata" && (
                      <Badge
                        tone={
                          l.status.startsWith("annullata") ? "danger" : "ok"
                        }
                      >
                        {STATUS_LABEL[l.status]}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">
                Nessuna lezione in programma.
              </p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title={`Compenso di ${monthLabel(month)}`}
              subtitle={STATE_LABEL[st.stato]}
            />
            <div className="grid grid-cols-2 gap-4 p-5 text-sm">
              <div>
                <p className="label-caps text-muted">Ore maturate</p>
                <p className="mt-1 font-serif text-2xl">
                  {formatHours(st.maturato.minutes)}
                </p>
                <p className="text-xs text-muted">
                  {formatEuro(st.maturato.cents)}
                </p>
              </div>
              <div>
                <p className="label-caps text-muted">Ore previste</p>
                <p className="mt-1 font-serif text-2xl">
                  {formatHours(st.previsto.minutes)}
                </p>
                <p className="text-xs text-muted">
                  {formatEuro(st.previsto.cents)}
                </p>
              </div>
              <div>
                <p className="label-caps text-muted">Già pagato</p>
                <p className="mt-1 font-serif text-2xl text-ok">
                  {formatEuro(st.pagato)}
                </p>
              </div>
              <div>
                <p className="label-caps text-muted">Da dare ora</p>
                <p className="mt-1 font-serif text-2xl text-pesca-deep">
                  {formatEuro(Math.max(0, st.residuo))}
                </p>
                <p className="text-xs text-muted">
                  stima fine mese {formatEuro(st.residuoStimato)}
                </p>
              </div>
            </div>
            {st.lezioniAnnullateSenzaCompenso > 0 && (
              <p className="border-t px-5 py-2 text-xs text-muted">
                {st.lezioniAnnullateSenzaCompenso} lezioni annullate senza
                compenso escluse dal conteggio.
              </p>
            )}
            <PaymentEntry
              action={addTutorPayout}
              idName="tutor_id"
              id={id}
              month={month}
              today={today}
              personName={`${tutor.first_name} ${tutor.last_name}`}
              suggested={Math.max(0, st.residuo)}
            />
            {(payouts ?? []).length > 0 && (
              <ul className="border-t px-5 py-3 text-sm">
                {(payouts ?? []).map((p) => (
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
                          value="tutor_payouts"
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
            <CardHeader
              title="Materie e livelli"
              subtitle="Livelli separati da virgola, es. elementari, medie, superiori. Vuoto = tutti"
            />
            <ul className="divide-y text-sm">
              {(links ?? []).map((l) => (
                <li key={l.subject_id} className="px-5 py-2.5">
                  <form
                    action={setTutorSubject}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="tutor_id" value={id} />
                    <input
                      type="hidden"
                      name="subject_id"
                      value={l.subject_id}
                    />
                    <span className="w-28 shrink-0 font-medium">
                      {subjectName.get(l.subject_id)}
                    </span>
                    <Input
                      name="levels"
                      defaultValue={l.levels.join(", ")}
                      placeholder="tutti i livelli"
                      className="py-1 text-xs"
                    />
                    <Button size="sm" variant="ghost">
                      Salva
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      name="delete"
                      value="1"
                      aria-label="Rimuovi materia"
                    >
                      <Trash2 />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
            <SubjectAssignmentEntry
              action={setTutorSubject}
              tutorId={id}
              subjects={subjects ?? []}
            />
          </Card>

          <Card>
            <CardHeader title="Dati e tariffe" />
            <form
              action={upsertTutor}
              className="grid grid-cols-2 gap-3 p-5 text-sm"
            >
              <input type="hidden" name="id" value={id} />
              <Field label="Nome">
                <Input
                  name="first_name"
                  defaultValue={tutor.first_name}
                  required
                />
              </Field>
              <Field label="Cognome">
                <Input name="last_name" defaultValue={tutor.last_name} />
              </Field>
              <Field label="Telefono WhatsApp" className="col-span-2">
                <Input
                  name="phone"
                  defaultValue={tutor.phone ?? ""}
                  placeholder="Telefono"
                  className="col-span-2"
                />
              </Field>
              <Field label="Email" className="col-span-2">
                <Input
                  name="email"
                  defaultValue={tutor.email ?? ""}
                  placeholder="Email"
                  className="col-span-2"
                />
              </Field>
              <Field label="€/ora singola">
                <Input
                  name="hourly_rate"
                  defaultValue={
                    tutor.hourly_rate_cents ? tutor.hourly_rate_cents / 100 : ""
                  }
                  placeholder={String(rates.defaultTutorHourly / 100)}
                />
              </Field>
              <Field label="€/ora gruppo">
                <Input
                  name="group_hourly_rate"
                  defaultValue={
                    tutor.group_hourly_rate_cents
                      ? tutor.group_hourly_rate_cents / 100
                      : ""
                  }
                  placeholder={String(rates.defaultTutorGroupHourly / 100)}
                />
              </Field>
              <Field label="Max ore/settimana">
                <Input
                  name="max_weekly_hours"
                  defaultValue={
                    tutor.max_weekly_minutes
                      ? tutor.max_weekly_minutes / 60
                      : ""
                  }
                />
              </Field>
              <Field label="Max ore/giorno">
                <Input
                  name="max_daily_hours"
                  defaultValue={
                    tutor.max_daily_minutes ? tutor.max_daily_minutes / 60 : ""
                  }
                />
              </Field>
              <div className="col-span-2 @container">
                <TeachingModes defaultValues={tutor.modes} />
              </div>
              <Select
                name="active"
                defaultValue={tutor.active ? "on" : "off"}
                className="col-span-2"
              >
                <option value="on">Attivo</option>
                <option value="off">
                  Non attivo (escluso dalla pianificazione)
                </option>
              </Select>
              <Button size="sm" variant="primary" className="col-span-2">
                Salva
              </Button>
            </form>
            <p className="border-t px-5 py-3 text-xs text-muted">
              Giorni con disponibilità:{" "}
              {WEEKDAYS.filter((_, i) =>
                (availability ?? []).some((w) => w.weekday === i),
              ).join(", ") || "nessuna"}
              .
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
