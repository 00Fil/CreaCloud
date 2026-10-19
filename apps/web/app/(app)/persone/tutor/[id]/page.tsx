import { SubjectAssignmentEntry } from "@/components/entries/people";
import { HoursEntry, AbsenceEntry } from "@/components/entries/scheduling";
import { TeachingModes } from "@/components/entries/primitives";
import { PaymentEntry } from "@/components/entries/payment";
import {
  ArrowLeft,
  Bot,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
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
import { Sheet } from "@/components/kit/sheet";
import { SheetForm } from "@/components/kit/sheet-form";
import { Tabs } from "@/components/kit/tabs";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  cn,
  Empty,
  Field,
  Input,
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
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
  const upcoming = lessons.filter((l) => l.date >= today);
  const past = lessons.filter((l) => l.date < today).reverse();
  const fullName = `${tutor.first_name} ${tutor.last_name}`.trim();
  const due = Math.max(0, st.residuo);
  const weeklyMinutes = (availability ?? []).reduce(
    (a, w) => a + (w.end_min - w.start_min),
    0,
  );

  const lessonList = (list: typeof lessons, emptyText: string) =>
    list.length ? (
      <ul className="divide-y">
        {list.map((l) => (
          <li key={l.id}>
            <Link
              href={`/calendario?giorno=${l.date}&lezione=${l.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm hover:bg-ink/[0.03]"
            >
              <span className="w-24 shrink-0">
                <span className="block font-semibold">{shortDate(l.date)}</span>
                <span className="tabular-nums text-muted">
                  {hhmm(l.start_min)}–{hhmm(l.end_min)}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate font-medium",
                    l.status.startsWith("annullata") &&
                      "line-through opacity-60",
                  )}
                >
                  {l.subject}
                </span>
                <span className="text-xs text-muted">
                  {l.student_names.join(", ")}
                </span>
              </span>
              {l.mode === "online" && <Badge>online</Badge>}
              {l.student_ids.length > 1 && (
                <Badge tone="pervinca">gruppo</Badge>
              )}
              {l.status !== "programmata" && (
                <Badge
                  tone={l.status.startsWith("annullata") ? "danger" : "ok"}
                >
                  {STATUS_LABEL[l.status]}
                </Badge>
              )}
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <Empty>{emptyText}</Empty>
    );

  const removeButton = (
    table: string,
    rowId: string,
    label: string,
    success: string,
  ) => (
    <SheetForm action={removeRow} success={success}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={rowId} />
      <input type="hidden" name="path" value={path} />
      <Button
        size="sm"
        variant="ghost"
        aria-label={label}
        confirmMessage={`${label}?`}
        confirmLabel="Elimina"
        className="text-muted hover:text-danger"
      >
        <Trash2 />
      </Button>
    </SheetForm>
  );

  const paymentSheet = (
    <Sheet
      variant="primary"
      trigger={
        <>
          <Wallet aria-hidden="true" /> Registra pagamento
        </>
      }
      title="Registra un pagamento al tutor"
      description={`${fullName} · ${monthLabel(month)}${due ? ` · da dare ${formatEuro(due)}` : ""}`}
    >
      <PaymentEntry
        action={addTutorPayout}
        idName="tutor_id"
        id={id}
        month={month}
        today={today}
        personName={fullName}
        suggested={due}
      />
    </Sheet>
  );

  const editSheet = (
    <Sheet
      trigger={
        <>
          <Pencil aria-hidden="true" /> Modifica dati
        </>
      }
      title={`Dati di ${tutor.first_name}`}
      description="Contatti, tariffe, limiti e modalità di lezione."
    >
      <SheetForm
        action={upsertTutor}
        success="Dati del tutor salvati"
        className="grid gap-4 sm:grid-cols-2"
      >
        <input type="hidden" name="id" value={id} />
        <Field label="Nome">
          <Input name="first_name" defaultValue={tutor.first_name} required />
        </Field>
        <Field label="Cognome">
          <Input name="last_name" defaultValue={tutor.last_name} />
        </Field>
        <Field label="Telefono WhatsApp">
          <Input name="phone" type="tel" defaultValue={tutor.phone ?? ""} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={tutor.email ?? ""} />
        </Field>
        <Field
          label="€/ora singola"
          hint={`Vuoto: ${rates.defaultTutorHourly / 100} € del centro`}
        >
          <Input
            name="hourly_rate"
            inputMode="decimal"
            defaultValue={
              tutor.hourly_rate_cents ? tutor.hourly_rate_cents / 100 : ""
            }
          />
        </Field>
        <Field
          label="€/ora gruppo"
          hint={`Vuoto: ${rates.defaultTutorGroupHourly / 100} € del centro`}
        >
          <Input
            name="group_hourly_rate"
            inputMode="decimal"
            defaultValue={
              tutor.group_hourly_rate_cents
                ? tutor.group_hourly_rate_cents / 100
                : ""
            }
          />
        </Field>
        <Field label="Max ore a settimana" hint="Vuoto: nessun limite">
          <Input
            name="max_weekly_hours"
            inputMode="decimal"
            defaultValue={
              tutor.max_weekly_minutes ? tutor.max_weekly_minutes / 60 : ""
            }
          />
        </Field>
        <Field label="Max ore al giorno" hint="Vuoto: nessun limite">
          <Input
            name="max_daily_hours"
            inputMode="decimal"
            defaultValue={
              tutor.max_daily_minutes ? tutor.max_daily_minutes / 60 : ""
            }
          />
        </Field>
        <div className="@container sm:col-span-2">
          <TeachingModes defaultValues={tutor.modes} />
        </div>
        <Field label="Stato" className="sm:col-span-2">
          <Select name="active" defaultValue={tutor.active ? "on" : "off"}>
            <option value="on">Attivo</option>
            <option value="off">
              Non attivo (escluso dalla pianificazione)
            </option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Button variant="primary">Salva</Button>
        </div>
      </SheetForm>
    </Sheet>
  );

  // ------------------------------------------------------------ disponibilità
  const availabilityTab = (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader
          title="Settimana tipo"
          subtitle={`${formatHours(weeklyMinutes)} disponibili a settimana`}
          action={
            <Sheet
              variant="ghost"
              trigger={
                <>
                  <Plus aria-hidden="true" /> Fascia
                </>
              }
              title="Aggiungi disponibilità"
              description={`Quando ${tutor.first_name} può fare lezione, ogni settimana.`}
              wide
            >
              <HoursEntry action={addAvailability} tutorId={id} />
            </Sheet>
          }
        />
        <ul className="divide-y">
          {WEEKDAYS.map((d, i) => {
            const slots = (availability ?? []).filter((w) => w.weekday === i);
            return (
              <li key={d} className="flex items-center gap-3 px-5 py-2">
                <span className="w-12 shrink-0 text-sm font-semibold capitalize">
                  {WEEKDAYS_SHORT[i]}
                </span>
                <span className="flex min-h-11 flex-1 flex-wrap items-center gap-1.5">
                  {slots.length ? (
                    slots.map((w) => (
                      <span
                        key={w.id}
                        className="inline-flex items-center gap-1 rounded-full bg-pervinca/12 py-0.5 pl-3 text-sm tabular-nums"
                      >
                        {hhmm(w.start_min)}–{hhmm(w.end_min)}
                        {w.source === "ai" && (
                          <Bot
                            aria-label="da WhatsApp"
                            className="size-3.5 text-pervinca-strong"
                          />
                        )}
                        {removeButton(
                          "tutor_availability",
                          w.id,
                          `Rimuovi fascia di ${d} ${hhmm(w.start_min)}–${hhmm(w.end_min)}`,
                          "Fascia rimossa",
                        )}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted">—</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <CardHeader
          title="Assenze in arrivo"
          subtitle="Il motore non colloca lezioni in questi momenti"
          action={
            <Sheet
              variant="ghost"
              trigger={
                <>
                  <Plus aria-hidden="true" /> Assenza
                </>
              }
              title="Registra un’assenza"
              description={fullName}
              wide
            >
              <AbsenceEntry action={addAbsence} tutorId={id} />
            </Sheet>
          }
        />
        {(absences ?? []).length ? (
          <ul className="divide-y text-sm">
            {(absences ?? []).map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-1.5">
                <span className="w-24 shrink-0 font-semibold">
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
                {removeButton(
                  "tutor_absences",
                  a.id,
                  `Elimina assenza del ${shortDate(a.date)}`,
                  "Assenza eliminata",
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nessuna assenza registrata.</Empty>
        )}
      </Card>
    </div>
  );

  // ------------------------------------------------------------ materie
  const subjectsTab = (
    <Card>
      <CardHeader
        title="Materie e livelli"
        subtitle="Livelli separati da virgola, es. elementari, medie, superiori. Vuoto: tutti."
        action={
          <Sheet
            variant="ghost"
            trigger={
              <>
                <Plus aria-hidden="true" /> Materia
              </>
            }
            title="Aggiungi una materia"
            description={fullName}
          >
            <SubjectAssignmentEntry
              action={setTutorSubject}
              tutorId={id}
              subjects={subjects ?? []}
            />
          </Sheet>
        }
      />
      {(links ?? []).length ? (
        <ul className="divide-y text-sm">
          {(links ?? []).map((l) => (
            <li key={l.subject_id} className="px-5 py-2.5">
              <SheetForm
                action={setTutorSubject}
                success="Materia aggiornata"
                className="flex flex-wrap items-center gap-2"
              >
                <input type="hidden" name="tutor_id" value={id} />
                <input type="hidden" name="subject_id" value={l.subject_id} />
                <label
                  htmlFor={`lv-${l.subject_id}`}
                  className="w-32 shrink-0 font-semibold"
                >
                  {subjectName.get(l.subject_id)}
                </label>
                <Input
                  id={`lv-${l.subject_id}`}
                  name="levels"
                  defaultValue={l.levels.join(", ")}
                  placeholder="tutti i livelli"
                  className="min-w-40 flex-1"
                />
                <Button size="sm" variant="outline">
                  Salva
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  name="delete"
                  value="1"
                  aria-label={`Rimuovi ${subjectName.get(l.subject_id)}`}
                  confirmMessage={`Rimuovere ${subjectName.get(l.subject_id)} dalle materie di ${tutor.first_name}?`}
                  confirmLabel="Rimuovi"
                >
                  <Trash2 />
                </Button>
              </SheetForm>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          Nessuna materia: aggiungine una perché il tutor possa ricevere
          lezioni.
        </Empty>
      )}
    </Card>
  );

  // ------------------------------------------------------------ compenso
  const payTab = (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader
          title={`Compenso di ${monthLabel(month)}`}
          subtitle={STATE_LABEL[st.stato]}
          action={paymentSheet}
        />
        <dl className="grid grid-cols-2 gap-4 p-5 text-sm">
          {[
            [
              "Ore maturate",
              formatHours(st.maturato.minutes),
              formatEuro(st.maturato.cents),
              "",
            ],
            [
              "Ore previste",
              formatHours(st.previsto.minutes),
              formatEuro(st.previsto.cents),
              "",
            ],
            ["Già pagato", formatEuro(st.pagato), "", "text-ok"],
            [
              "Da dare ora",
              formatEuro(due),
              `stima fine mese ${formatEuro(st.residuoStimato)}`,
              "text-pesca-deep",
            ],
          ].map(([label, value, hint, tone]) => (
            <div key={label}>
              <dt className="label-caps text-muted">{label}</dt>
              <dd className={cn("mt-1 font-serif text-2xl", tone)}>{value}</dd>
              {hint && <dd className="text-xs text-muted">{hint}</dd>}
            </div>
          ))}
        </dl>
        {st.lezioniAnnullateSenzaCompenso > 0 && (
          <p className="border-t px-5 py-3 text-xs text-muted">
            {st.lezioniAnnullateSenzaCompenso} lezioni annullate senza compenso
            escluse dal conteggio.
          </p>
        )}
      </Card>
      <Card>
        <CardHeader title="Pagamenti registrati" subtitle="Ultimi 24" />
        {(payouts ?? []).length ? (
          <ul className="divide-y text-sm">
            {(payouts ?? []).map((p) => (
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
                {removeButton(
                  "tutor_payouts",
                  p.id,
                  `Elimina pagamento del ${shortDate(p.paid_on)}`,
                  "Pagamento eliminato",
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nessun pagamento registrato.</Empty>
        )}
      </Card>
    </div>
  );

  return (
    <>
      <Link
        href="/persone?tab=tutor"
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-pervinca-strong hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Tutor
      </Link>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label-caps mb-1.5 text-pesca">Tutor</p>
          <h1 className="text-3xl leading-tight sm:text-4xl">{fullName}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
            {tutor.phone && <span>{tutor.phone}</span>}
            {(links ?? []).map((l) => (
              <Badge key={l.subject_id} tone="pervinca">
                {subjectName.get(l.subject_id)}
              </Badge>
            ))}
            {!tutor.active && <Badge tone="warn">non attivo</Badge>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {chat && (
            <Link
              href={`/chat/${chat.id}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-xs font-bold uppercase tracking-[0.15em] text-pervinca-strong hover:bg-pervinca/10"
            >
              <MessageCircle aria-hidden="true" className="size-4" /> Chat
            </Link>
          )}
          {editSheet}
          {paymentSheet}
        </div>
      </header>

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [
            "Disponibile",
            `${formatHours(weeklyMinutes)}/sett.`,
            weeklyMinutes ? null : "text-warn",
          ],
          ["Lezioni in programma", String(upcoming.length), null],
          [
            "Ore questo mese",
            formatHours(st.maturato.minutes + st.previsto.minutes),
            null,
          ],
          ["Da dare ora", formatEuro(due), due ? "text-pesca-deep" : null],
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
            id: "disponibilita",
            label: "Disponibilità",
            badge: (absences ?? []).length || undefined,
            content: availabilityTab,
          },
          {
            id: "lezioni",
            label: "Lezioni",
            badge: upcoming.length,
            content: (
              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader
                    title="In programma"
                    subtitle="Prossimi 31 giorni"
                  />
                  {lessonList(upcoming, "Nessuna lezione in programma.")}
                </Card>
                <Card>
                  <CardHeader title="Già fatte" subtitle={monthLabel(month)} />
                  {lessonList(past, "Nessuna lezione questo mese.")}
                </Card>
              </div>
            ),
          },
          {
            id: "materie",
            label: "Materie",
            badge: (links ?? []).length,
            content: subjectsTab,
          },
          { id: "compenso", label: "Compenso", content: payTab },
        ]}
      />
    </>
  );
}
