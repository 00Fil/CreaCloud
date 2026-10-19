import {
  AlertTriangle,
  CalendarCheck,
  Check,
  Clock,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";

import {
  approveGroup,
  confirmPlan,
  discardPlan,
  sendSchedules,
  startPlan,
} from "@/app/(app)/actions/planning";
import { Sheet } from "@/components/kit/sheet";
import { SheetForm } from "@/components/kit/sheet-form";
import { Tabs } from "@/components/kit/tabs";
import { LiveRefresh } from "@/components/live-refresh";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  cn,
  Empty,
  Field,
  PageHeader,
  PriorityBadge,
  Select,
  Stat,
} from "@/components/ui";
import { sessionClient } from "@/lib/db/clients";
import { formatHours } from "@/lib/domain/billing";
import {
  addMonths,
  hhmm,
  monthLabel,
  monthStart,
  romeParts,
  shortDate,
  todayRome,
  weekdayOf,
  WEEKDAYS,
} from "@/lib/domain/time";
import type {
  EngineProblem,
  EngineSolution,
  Occurrence,
} from "@/lib/planning/engine-types";

type Search = {
  run?: string;
  tab?: string;
  confermato?: string;
  inviati?: string;
  errori?: string;
};

const RUN_STATUS: Record<string, string> = {
  bozza: "bozza",
  confermato: "confermato",
  scartato: "scartato",
  errore: "errore",
};

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const db = await sessionClient();
  const today = todayRome();
  const thisMonth = monthStart(today);
  const months = [thisMonth, addMonths(thisMonth, 1), addMonths(thisMonth, 2)];

  const { data: runs } = await db
    .from("planning_runs")
    .select(
      "id, month, status, error, created_at, confirmed_at, stats:solution->stats",
    )
    .order("created_at", { ascending: false })
    .limit(12);
  const selectedId =
    sp.run ?? runs?.find((r) => r.status === "bozza")?.id ?? runs?.[0]?.id;
  const { data: run } = selectedId
    ? await db
        .from("planning_runs")
        .select("*")
        .eq("id", selectedId)
        .maybeSingle()
    : { data: null };
  const computing = run?.status === "bozza" && !run.solution && !run.error;

  const step =
    !run || run.status === "scartato" || run.status === "errore"
      ? 0
      : computing
        ? 0
        : run.status === "bozza"
          ? 1
          : 3;
  const STEPS = [
    ["Calcola", "il motore prepara una bozza"],
    ["Rivedi", "problemi, variazioni e gruppi"],
    ["Conferma", "scrive le lezioni nel calendario"],
    ["Invia", "orari via WhatsApp"],
  ];

  const sendSheet = (
    <Sheet
      variant={step === 3 ? "primary" : "outline"}
      trigger={
        <>
          <Send aria-hidden="true" /> Invia gli orari
        </>
      }
      title="Invia gli orari"
      description="Un messaggio WhatsApp con le lezioni future del calendario confermato."
    >
      <form action={sendSchedules} className="flex flex-col gap-5">
        <Field label="Mese">
          <Select name="month" defaultValue={run?.month ?? thisMonth}>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Destinatari">
          <Select name="target" defaultValue="tutti">
            <option value="tutti">Famiglie e tutor</option>
            <option value="famiglie">Solo famiglie</option>
            <option value="tutor">Solo tutor</option>
          </Select>
        </Field>
        <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-soft">
          Parte solo quando premi. Ogni famiglia e ogni tutor riceve le proprie
          lezioni future del mese scelto.
        </p>
        <div>
          <Button
            variant="primary"
            confirmMessage="Verranno inviati messaggi WhatsApp ai destinatari selezionati, con le lezioni future del calendario confermato per il mese scelto. Controlla mese e destinatari prima di continuare."
            confirmLabel="Invia gli orari"
          >
            <Send /> Invia gli orari
          </Button>
        </div>
      </form>
    </Sheet>
  );

  return (
    <>
      <LiveRefresh tables={["planning_runs"]} />
      <PageHeader
        eyebrow="Motore di pianificazione"
        title="Piano mensile"
        action={
          <>
            <form action={startPlan} className="flex flex-wrap gap-2">
              <Select
                name="month"
                aria-label="Mese da pianificare"
                defaultValue={months[1]}
                className="w-auto"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </Select>
              <Button variant={step === 0 ? "primary" : "outline"}>
                <Sparkles /> Calcola bozza
              </Button>
            </form>
            {sendSheet}
          </>
        }
      >
        Le lezioni bloccate o spostate a mano restano dove sono. Il calendario
        cambia solo quando confermi, e nessun messaggio parte da solo.
      </PageHeader>

      <ol
        aria-label="Passaggi"
        className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {STEPS.map(([title, hint], i) => {
          const done = i < step || (i === 2 && step === 3);
          const current = i === step;
          return (
            <li
              key={title}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
                current ? "border-pervinca bg-pervinca/10" : "bg-surface",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  done
                    ? "bg-ok/15 text-ok"
                    : current
                      ? "bg-pervinca text-[#292524]"
                      : "bg-ink/5 text-muted",
                )}
              >
                {done ? <Check aria-label="fatto" className="size-4" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block truncate text-xs text-muted">
                  {hint}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {sp.confermato && (
        <Notice tone="ok">
          Piano confermato: {sp.confermato} lezioni scritte nel calendario. Ora
          puoi inviare gli orari.
        </Notice>
      )}
      {sp.inviati && (
        <Notice tone={Number(sp.errori) ? "warn" : "ok"}>
          Orari inviati a {sp.inviati} persone
          {Number(sp.errori)
            ? `, ${sp.errori} invii non riusciti (vedi chat)`
            : ""}
          .
        </Notice>
      )}

      {(runs ?? []).length > 0 && (
        <nav aria-label="Bozze recenti" className="mb-6">
          <p className="label-caps mb-2 text-muted">Bozze recenti</p>
          <ul className="thin-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {(runs ?? []).map((r) => {
              const stats = (r.stats ?? {}) as Record<string, number>;
              const at = romeParts(new Date(r.created_at));
              return (
                <li key={r.id} className="shrink-0">
                  <Link
                    href={`/piano?run=${r.id}`}
                    aria-current={r.id === selectedId ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-full border px-4 py-1.5 text-sm",
                      r.id === selectedId
                        ? "border-pervinca bg-pervinca/10"
                        : "bg-surface hover:bg-ink/[0.03]",
                    )}
                  >
                    <span className="font-semibold capitalize">
                      {monthLabel(r.month)}
                    </span>
                    <span className="text-xs text-muted">
                      {shortDate(at.date)} {hhmm(at.minutes)}
                      {stats.sessions
                        ? ` · ${stats.sessions_placed}/${stats.sessions}`
                        : ""}
                    </span>
                    <Badge
                      tone={
                        r.status === "confermato"
                          ? "ok"
                          : r.status === "errore"
                            ? "danger"
                            : r.status === "bozza"
                              ? "pervinca"
                              : "neutral"
                      }
                    >
                      {RUN_STATUS[r.status]}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <div className="flex min-w-0 flex-col gap-6">
        {!run && (
          <Card>
            <Empty>
              Nessun piano ancora. Scegli il mese in alto e calcola la prima
              bozza.
            </Empty>
          </Card>
        )}
        {run && computing && (
          <Card className="flex items-center gap-4 p-6">
            <Clock className="size-6 animate-pulse text-pervinca" />
            <div>
              <p className="font-semibold">
                Sto calcolando il piano di {monthLabel(run.month)}…
              </p>
              <p className="text-sm text-muted">
                Di solito servono uno o due minuti. La pagina si aggiorna da
                sola.
              </p>
            </div>
          </Card>
        )}
        {run?.status === "errore" && (
          <Card className="p-6">
            <p className="font-semibold text-danger">
              Il calcolo non è riuscito
            </p>
            <p className="mt-1 break-words text-sm text-muted">{run.error}</p>
          </Card>
        )}
        {run?.solution && <RunView run={run as RunRow} tab={sp.tab} />}
      </div>
    </>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "ok" | "warn";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "mb-5 rounded-2xl px-4 py-3 text-sm font-medium",
        tone === "ok" ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn",
      )}
    >
      {children}
    </p>
  );
}

type RunRow = {
  id: string;
  month: string;
  status: string;
  problem: EngineProblem;
  solution: EngineSolution;
};

async function RunView({ run, tab }: { run: RunRow; tab?: string }) {
  const db = await sessionClient();
  const { data: subjects } = await db.from("subjects").select("id, name");
  const subject = new Map((subjects ?? []).map((s) => [s.id, s.name]));
  const student = new Map(run.problem.students.map((s) => [s.id, s.name]));
  const tutor = new Map(run.problem.tutors.map((t) => [t.id, t.name]));
  const sol = run.solution;
  const s = sol.stats;
  const names = (ids: string[]) =>
    ids.map((i) => student.get(i) ?? "?").join(", ");

  // una riga per sessione ricorrente: l'orario più frequente e le eccezioni
  const bySession = new Map<string, Occurrence[]>();
  for (const o of sol.occurrences) {
    const k = `${o.request_id}|${o.session_index}`;
    bySession.set(k, [...(bySession.get(k) ?? []), o]);
  }
  const sessions = [...bySession.values()]
    .map((occ) => {
      const count = new Map<string, number>();
      for (const o of occ) {
        const k = `${weekdayOf(o.date)}|${o.start}|${o.end}|${o.tutor_id}`;
        count.set(k, (count.get(k) ?? 0) + 1);
      }
      const [pattern] = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
      const [wd, start, end, tutorId] = pattern.split("|");
      const exceptions = occ.filter(
        (o) =>
          `${weekdayOf(o.date)}|${o.start}|${o.end}|${o.tutor_id}` !== pattern,
      );
      const violations = new Map(
        occ.flatMap((o) => o.violations).map((v) => [v.constraint_id, v]),
      );
      return {
        first: occ[0],
        occ,
        weekday: Number(wd),
        start: Number(start),
        end: Number(end),
        tutorId,
        exceptions,
        violations: [...violations.values()],
        durationChanged: occ.some((o) => o.duration_changed),
        relocated: occ.some((o) => o.relocated || o.moved_from_existing),
      };
    })
    .sort((a, b) => a.weekday - b.weekday || a.start - b.start);
  const flagged = sessions.filter(
    (x) =>
      x.violations.length ||
      x.durationChanged ||
      x.exceptions.length ||
      x.relocated,
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Lezioni collocate"
          value={`${s.sessions_placed ?? 0}/${s.sessions ?? 0}`}
          hint={`${sol.occurrences.length} incontri nel mese`}
          tone="pervinca"
        />
        <Stat
          label="Non collocate"
          value={sol.unplaced.length}
          tone={sol.unplaced.length ? "warn" : undefined}
        />
        <Stat
          label="Con segnalazioni"
          value={flagged.length}
          hint="durata, orario o impegni"
          tone="pesca"
        />
        <Stat
          label="Gruppi suggeriti"
          value={sol.group_suggestions.length}
          hint={`calcolo ${Math.round(sol.solve_seconds)}s · ${sol.status}`}
        />
      </div>

      <Tabs
        initial={
          tab ??
          (sol.unplaced.length
            ? "problemi"
            : flagged.length
              ? "variazioni"
              : "tutte")
        }
        items={[
          {
            id: "problemi",
            label: "Non collocate",
            badge: sol.unplaced.length,
            icon: (
              <AlertTriangle aria-hidden="true" className="size-4 text-warn" />
            ),
            content: (
              <Card>
                <CardHeader
                  title="Lezioni non collocate"
                  subtitle="Restano fuori quelle che avrebbero violato gli impegni più importanti"
                />
                {sol.unplaced.length ? (
                  <ul className="divide-y">
                    {sol.unplaced.map((u, i) => (
                      <li key={i} className="px-5 py-4 text-sm">
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          {names(u.student_ids)} · {subject.get(u.subject_id)}
                          {u.date ? (
                            <Badge>{shortDate(u.date)}</Badge>
                          ) : (
                            u.session_index !== null && (
                              <Badge>
                                incontro {u.session_index + 1} della settimana
                              </Badge>
                            )
                          )}
                        </p>
                        <ul className="mt-1.5 list-disc pl-5 text-ink-soft">
                          {u.reasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                        {u.suggestions.length > 0 && (
                          <p className="mt-2 rounded-xl bg-pervinca/8 px-3 py-2 text-xs text-pervinca-strong">
                            Possibili soluzioni: {u.suggestions.join(" · ")}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>
                    Tutte le lezioni richieste sono state collocate.
                  </Empty>
                )}
              </Card>
            ),
          },
          {
            id: "variazioni",
            label: "Variazioni",
            badge: flagged.length,
            content: (
              <Card>
                <CardHeader
                  title="Lezioni con segnalazioni"
                  subtitle="Piccole variazioni fatte dal motore per incastrare tutte le richieste"
                />
                {flagged.length ? (
                  <SessionList
                    rows={flagged}
                    subject={subject}
                    tutor={tutor}
                    names={names}
                  />
                ) : (
                  <Empty>Nessuna variazione: tutto come richiesto.</Empty>
                )}
              </Card>
            ),
          },
          {
            id: "gruppi",
            label: "Gruppi suggeriti",
            badge: sol.group_suggestions.length,
            content: (
              <Card>
                <CardHeader
                  title="Gruppi possibili"
                  subtitle="Studenti con stessa materia e livello. Approvandolo, le loro richieste singole vengono sospese; poi ricalcola la bozza."
                />
                {sol.group_suggestions.length ? (
                  <ul className="divide-y">
                    {sol.group_suggestions.map((g, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm"
                      >
                        <Users
                          aria-hidden="true"
                          className="size-5 text-pervinca"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {subject.get(g.subject_id)}{" "}
                            {g.level && <Badge>{g.level}</Badge>}{" "}
                            {g.topic && (
                              <Badge tone="pervinca">{g.topic}</Badge>
                            )}
                          </p>
                          <p className="text-ink-soft">
                            {names(g.student_ids)}
                          </p>
                          <p className="text-xs text-muted">
                            {g.note} · tutor possibili:{" "}
                            {g.tutor_ids.map((t) => tutor.get(t)).join(", ")}
                          </p>
                        </div>
                        <SheetForm
                          action={approveGroup}
                          success="Gruppo approvato: ricalcola la bozza"
                        >
                          <input type="hidden" name="run_id" value={run.id} />
                          <input type="hidden" name="index" value={i} />
                          <Button size="sm" variant="outline">
                            Approva gruppo
                          </Button>
                        </SheetForm>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>Nessun gruppo da proporre.</Empty>
                )}
              </Card>
            ),
          },
          {
            id: "tutte",
            label: "Tutte le lezioni",
            badge: sessions.length,
            content: (
              <Card>
                <SessionList
                  rows={sessions}
                  subject={subject}
                  tutor={tutor}
                  names={names}
                />
              </Card>
            ),
          },
        ]}
      />

      {run.status === "bozza" && (
        <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 flex flex-col gap-3 rounded-2xl border bg-surface/95 p-4 shadow-xl backdrop-blur-md sm:flex-row sm:items-center lg:bottom-4">
          <p className="flex-1 text-sm">
            Bozza di{" "}
            <strong className="capitalize">{monthLabel(run.month)}</strong>:
            confermando, le lezioni future non bloccate del mese vengono
            sostituite.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={discardPlan}>
              <input type="hidden" name="run_id" value={run.id} />
              <Button
                variant="ghost"
                confirmMessage="Questa bozza verrà scartata. Il calendario confermato non verrà modificato."
                confirmLabel="Scarta bozza"
              >
                Scarta
              </Button>
            </form>
            <form action={confirmPlan}>
              <input type="hidden" name="run_id" value={run.id} />
              <Button
                variant="primary"
                confirmMessage="Le lezioni future non bloccate del mese saranno sostituite con questa bozza. Le lezioni bloccate rimarranno invariate. Nessun messaggio verrà inviato automaticamente."
                confirmLabel="Conferma nel calendario"
              >
                <CalendarCheck /> Conferma nel calendario
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

type SessionRow = {
  first: Occurrence;
  occ: Occurrence[];
  weekday: number;
  start: number;
  end: number;
  tutorId: string;
  exceptions: Occurrence[];
  violations: {
    constraint_id: string;
    priority: number;
    label: string;
    student_id: string;
  }[];
  durationChanged: boolean;
  relocated: boolean;
};

function SessionList({
  rows,
  subject,
  tutor,
  names,
}: {
  rows: SessionRow[];
  subject: Map<string, string>;
  tutor: Map<string, string>;
  names: (ids: string[]) => string;
}) {
  return (
    <ul className="divide-y text-sm">
      {rows.map((r) => (
        <li
          key={`${r.first.request_id}|${r.first.session_index}`}
          className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:gap-4"
        >
          <span className="w-44 shrink-0 tabular-nums">
            <span className="font-semibold capitalize">
              {WEEKDAYS[r.weekday]}
            </span>{" "}
            {hhmm(r.start)}–{hhmm(r.end)}
          </span>
          <div className="min-w-0 flex-1">
            <p>
              <span className="font-medium">{names(r.first.student_ids)}</span>{" "}
              · {subject.get(r.first.subject_id)} con {tutor.get(r.tutorId)}
              <span className="text-muted"> · {r.occ.length} incontri</span>
              {r.first.mode === "online" && (
                <Badge className="ml-2">online</Badge>
              )}
              {r.first.student_ids.length > 1 && (
                <Badge tone="pervinca" className="ml-2">
                  gruppo
                </Badge>
              )}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {r.durationChanged && (
                <Badge tone="pesca">
                  durata {formatHours(r.end - r.start)} invece di{" "}
                  {formatHours(r.first.requested_duration)}
                </Badge>
              )}
              {r.relocated && (
                <Badge tone="pervinca">orario cambiato rispetto a prima</Badge>
              )}
              {r.violations.map((v) => (
                <span
                  key={v.constraint_id}
                  className="inline-flex items-center gap-1 text-xs"
                >
                  <PriorityBadge priority={v.priority} /> sovrapposta a «
                  {v.label}»
                </span>
              ))}
            </div>
            {r.exceptions.length > 0 && (
              <p className="mt-1 text-xs text-muted">
                Eccezioni:{" "}
                {r.exceptions
                  .map(
                    (o) =>
                      `${shortDate(o.date)} ${hhmm(o.start)}${o.tutor_id !== r.tutorId ? ` con ${tutor.get(o.tutor_id)}` : ""}`,
                  )
                  .join(" · ")}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
