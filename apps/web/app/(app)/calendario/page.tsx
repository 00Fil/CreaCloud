import {
  CancelLessonEntry,
  MoveLessonEntry,
} from "@/components/entries/lessons";
import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
} from "lucide-react";
import Link from "next/link";

import {
  cancelLesson,
  markPastDone,
  moveLesson,
  setLessonStatus,
  toggleLock,
} from "@/app/(app)/actions/planning";
import { NavSelect } from "@/components/kit/nav-select";
import { RouteSheet } from "@/components/kit/sheet";
import { SheetForm } from "@/components/kit/sheet-form";
import { LiveRefresh } from "@/components/live-refresh";
import {
  Badge,
  Button,
  cn,
  LinkButton,
  PageHeader,
  Select,
} from "@/components/ui";
import { sessionClient } from "@/lib/db/clients";
import { loadSettings } from "@/lib/db/repo";
import {
  classifyCancellation,
  isCancelled,
  STATUS_LABEL,
  type LessonStatus,
} from "@/lib/domain/cancellation";
import {
  addDays,
  datesBetween,
  hhmm,
  longDate,
  shortDate,
  todayRome,
  weekdayOf,
  WEEKDAYS_SHORT,
} from "@/lib/domain/time";

type Search = { w?: string; tutor?: string; lezione?: string; giorno?: string };

const SELECT =
  "id, date, start_min, end_min, status, mode, locked, duration_changed, relocated, violations, tutor_id, room_id, cancellation_reason, cancelled_by, subjects(name), tutors(first_name, last_name), rooms(name), lesson_students(student_id, students(first_name, last_name, family_id))";

type Row = {
  id: string;
  date: string;
  start_min: number;
  end_min: number;
  status: LessonStatus;
  mode: "presenza" | "online";
  locked: boolean;
  duration_changed: boolean;
  relocated: boolean;
  violations: { label: string; priority: number }[];
  tutor_id: string;
  room_id: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  subjects: { name: string } | null;
  tutors: { first_name: string; last_name: string } | null;
  rooms: { name: string } | null;
  lesson_students: {
    student_id: string;
    students: {
      first_name: string;
      last_name: string;
      family_id: string;
    } | null;
  }[];
};

function mondayOf(date: string) {
  return addDays(date, -weekdayOf(date));
}

const HOUR_PX = 72;
const isDate = (v?: string) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? "");

/** Corsie per le lezioni contemporanee dello stesso giorno, affiancate nella griglia. */
function lanes(list: Row[]) {
  const out = new Map<string, { lane: number; of: number }>();
  let cluster: Row[] = [];
  let ends: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const l of cluster)
      out.set(l.id, { lane: out.get(l.id)!.lane, of: ends.length });
    cluster = [];
    ends = [];
  };
  for (const l of [...list].sort(
    (a, b) => a.start_min - b.start_min || a.end_min - b.end_min,
  )) {
    if (l.start_min >= clusterEnd) flush();
    let lane = ends.findIndex((e) => e <= l.start_min);
    if (lane === -1) lane = ends.push(l.end_min) - 1;
    else ends[lane] = l.end_min;
    out.set(l.id, { lane, of: 0 });
    cluster.push(l);
    clusterEnd = Math.max(clusterEnd, l.end_min);
  }
  flush();
  return out;
}

function students(l: Row) {
  return l.lesson_students
    .map((s) => s.students?.first_name)
    .filter(Boolean)
    .join(", ");
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const db = await sessionClient();
  const today = todayRome();
  const monday = mondayOf(
    isDate(sp.w) ? sp.w! : isDate(sp.giorno) ? sp.giorno! : today,
  );
  const days = datesBetween(monday, addDays(monday, 6));
  const [{ data: rows }, { data: tutors }, settings] = await Promise.all([
    (() => {
      let q = db
        .from("lessons")
        .select(SELECT)
        .gte("date", monday)
        .lte("date", addDays(monday, 6));
      if (sp.tutor) q = q.eq("tutor_id", sp.tutor);
      return q.order("start_min");
    })(),
    db
      .from("tutors")
      .select("id, first_name, last_name")
      .eq("active", true)
      .order("last_name"),
    loadSettings(db),
  ]);
  const lessons = (rows ?? []) as unknown as Row[];
  const visibleDays = days.filter(
    (d, i) => i < 6 || lessons.some((l) => l.date === d),
  );
  const { data: selectedRow } = sp.lezione
    ? await db.from("lessons").select(SELECT).eq("id", sp.lezione).maybeSingle()
    : { data: null };
  const selected = selectedRow as unknown as Row | null;
  const day =
    isDate(sp.giorno) && days.includes(sp.giorno!)
      ? sp.giorno!
      : days.includes(today)
        ? today
        : (visibleDays.find((d) => lessons.some((l) => l.date === d)) ??
          monday);

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const all = { w: monday, tutor: sp.tutor, giorno: day, ...extra };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    return `/calendario?${p.toString()}`;
  };
  const path = qs({});
  const pastOpen = lessons.filter(
    (l) => l.status === "programmata" && l.date < today,
  ).length;

  // finestra oraria della griglia: dalle 14 alle 20, allargata se serve
  const startHour = Math.min(
    14,
    ...lessons.map((l) => Math.floor(l.start_min / 60)),
  );
  const endHour = Math.max(
    20,
    ...lessons.map((l) => Math.ceil(l.end_min / 60)),
  );
  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i,
  );
  const lessonTone = (l: Row) =>
    cn(
      l.mode === "online"
        ? "border-pervinca bg-pervinca/12"
        : "border-pesca bg-pesca/12",
      isCancelled(l.status) && "opacity-50 line-through decoration-ink/30",
      l.id === selected?.id && "ring-2 ring-pervinca-strong",
    );
  const flag = (l: Row) =>
    (l.violations?.length > 0 || l.duration_changed) && (
      <span
        className="size-2 shrink-0 rounded-full bg-warn"
        title="Segnalazioni del motore"
      >
        <span className="sr-only">Segnalazioni del motore</span>
      </span>
    );
  const nowMin = (() => {
    const t = new Date().toLocaleTimeString("it-IT", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  })();

  const grid = (
    <div className="thin-scroll hidden overflow-x-auto rounded-2xl border bg-surface shadow-soft lg:block">
      <div
        className="grid min-w-[900px]"
        style={{
          gridTemplateColumns: `56px repeat(${visibleDays.length}, minmax(0, 1fr))`,
        }}
      >
        <div className="sticky left-0 border-b bg-surface" />
        {visibleDays.map((d) => (
          <Link
            key={d}
            href={qs({ giorno: d })}
            scroll={false}
            className={cn(
              "flex items-baseline justify-center gap-1.5 border-b border-l py-3",
              d === today && "bg-pesca/8",
            )}
          >
            <span
              className={cn(
                "label-caps",
                d === today ? "text-pesca-deep" : "text-muted",
              )}
            >
              {WEEKDAYS_SHORT[weekdayOf(d)]}
            </span>
            <span className="font-serif text-xl">{Number(d.slice(8))}</span>
            <span className="text-xs text-muted">
              {lessons.filter((l) => l.date === d && !isCancelled(l.status))
                .length || ""}
            </span>
          </Link>
        ))}
        <div className="relative" style={{ height: hours.length * HOUR_PX }}>
          {hours.map((h, i) => (
            <span
              key={h}
              className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted"
              style={{ top: i * HOUR_PX }}
            >
              {i > 0 && `${h}:00`}
            </span>
          ))}
        </div>
        {visibleDays.map((d) => {
          const dayLessons = lessons.filter((l) => l.date === d);
          const lane = lanes(dayLessons);
          return (
            <div
              key={d}
              className={cn(
                "relative border-l",
                d === today && "bg-pesca/[0.04]",
              )}
              style={{
                height: hours.length * HOUR_PX,
                backgroundImage: `repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px ${HOUR_PX}px)`,
              }}
            >
              {d === today &&
                nowMin > startHour * 60 &&
                nowMin < endHour * 60 && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 z-10 h-0.5 bg-pesca-strong"
                    style={{ top: ((nowMin - startHour * 60) / 60) * HOUR_PX }}
                  />
                )}
              {dayLessons.map((l) => {
                const { lane: n, of } = lane.get(l.id)!;
                const top = ((l.start_min - startHour * 60) / 60) * HOUR_PX;
                const height = ((l.end_min - l.start_min) / 60) * HOUR_PX;
                return (
                  <Link
                    key={l.id}
                    href={qs({ lezione: l.id, giorno: d })}
                    scroll={false}
                    title={`${hhmm(l.start_min)}–${hhmm(l.end_min)} · ${students(l)} · ${l.subjects?.name} con ${l.tutors?.first_name}`}
                    className={cn(
                      "absolute overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-[11px] leading-tight transition hover:z-20 hover:shadow-md",
                      lessonTone(l),
                    )}
                    style={{
                      top: top + 1,
                      height: height - 2,
                      left: `calc(${(n / of) * 100}% + 2px)`,
                      width: `calc(${100 / of}% - 4px)`,
                    }}
                  >
                    <span className="flex items-center gap-1 font-semibold tabular-nums">
                      {hhmm(l.start_min)}
                      {l.locked && (
                        <Lock
                          aria-label="bloccata"
                          className="size-3 text-muted"
                        />
                      )}
                      <span className="ml-auto">{flag(l)}</span>
                    </span>
                    <span className="block truncate font-medium">
                      {students(l)}
                    </span>
                    <span className="block truncate text-ink-soft">
                      {l.subjects?.name} · {l.tutors?.first_name}
                    </span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  const dayLessons = lessons.filter((l) => l.date === day);
  const agenda = (
    <div className="lg:hidden">
      <nav
        aria-label="Giorni della settimana"
        className="mb-4 grid grid-cols-7 gap-1"
      >
        {days.map((d) => {
          const n = lessons.filter(
            (l) => l.date === d && !isCancelled(l.status),
          ).length;
          const on = d === day;
          return (
            <Link
              key={d}
              href={qs({ giorno: d })}
              scroll={false}
              aria-current={on ? "date" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center rounded-2xl text-xs transition",
                on
                  ? "bg-ink text-paper"
                  : d === today
                    ? "bg-pesca/15"
                    : "bg-surface",
              )}
            >
              <span className="label-caps opacity-70">
                {WEEKDAYS_SHORT[weekdayOf(d)]}
              </span>
              <span className="font-serif text-lg leading-tight">
                {Number(d.slice(8))}
              </span>
              <span
                className={cn(
                  "mt-0.5 size-1.5 rounded-full",
                  n ? (on ? "bg-paper" : "bg-pervinca") : "bg-transparent",
                )}
              >
                <span className="sr-only">{n} lezioni</span>
              </span>
            </Link>
          );
        })}
      </nav>
      <h2 className="mb-3 text-xl capitalize">{longDate(day)}</h2>
      {dayLessons.length ? (
        <ol className="flex flex-col gap-2">
          {dayLessons.map((l) => (
            <li key={l.id}>
              <Link
                href={qs({ lezione: l.id })}
                scroll={false}
                className={cn(
                  "flex gap-3 rounded-2xl border-l-4 bg-surface p-3 shadow-sm",
                  lessonTone(l),
                )}
              >
                <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">
                  {hhmm(l.start_min)}
                  <span className="block text-xs font-normal text-muted">
                    {hhmm(l.end_min)}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{students(l)}</span>
                    {flag(l)}
                  </span>
                  <span className="block truncate text-sm text-ink-soft">
                    {l.subjects?.name} con {l.tutors?.first_name}{" "}
                    {l.tutors?.last_name}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {l.mode === "online" ? (
                      <Badge tone="pervinca">online</Badge>
                    ) : (
                      l.rooms && <Badge>{l.rooms.name}</Badge>
                    )}
                    {l.status !== "programmata" && (
                      <Badge tone={isCancelled(l.status) ? "danger" : "ok"}>
                        {STATUS_LABEL[l.status]}
                      </Badge>
                    )}
                    {l.locked && <Badge>bloccata</Badge>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted">
          Nessuna lezione in questo giorno.
        </p>
      )}
    </div>
  );

  return (
    <>
      <LiveRefresh tables={["lessons"]} />
      <PageHeader
        eyebrow="Calendario"
        title={`Settimana del ${shortDate(monday)}`}
        action={
          <>
            <NavSelect
              label="Filtra per tutor"
              value={sp.tutor ?? ""}
              options={[
                {
                  value: "",
                  label: "Tutti i tutor",
                  href: qs({ tutor: undefined }),
                },
                ...(tutors ?? []).map((t) => ({
                  value: t.id,
                  label: `${t.first_name} ${t.last_name}`,
                  href: qs({ tutor: t.id }),
                })),
              ]}
            />
            <span className="flex gap-1">
              <LinkButton
                href={qs({ w: addDays(monday, -7), giorno: undefined })}
                variant="outline"
                size="sm"
                aria-label="Settimana precedente"
              >
                <ChevronLeft />
              </LinkButton>
              <LinkButton
                href={qs({ w: today, giorno: today })}
                variant="outline"
                size="sm"
              >
                Oggi
              </LinkButton>
              <LinkButton
                href={qs({ w: addDays(monday, 7), giorno: undefined })}
                variant="outline"
                size="sm"
                aria-label="Settimana successiva"
              >
                <ChevronRight />
              </LinkButton>
            </span>
          </>
        }
      >
        <span className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-pesca" /> in presenza
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-pervinca" /> online
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-warn" /> segnalazioni del
            motore
          </span>
        </span>
      </PageHeader>

      {pastOpen > 0 && (
        <SheetForm
          action={markPastDone}
          success="Lezioni passate segnate come svolte"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-pesca/10 px-4 py-3 text-sm"
        >
          <span className="flex-1">
            {pastOpen} lezioni passate sono ancora «programmate»: contano già
            nei conti, ma puoi segnarle come svolte.
          </span>
          <Button size="sm" variant="outline">
            <CheckCheck aria-hidden="true" /> Segna come svolte
          </Button>
        </SheetForm>
      )}

      {grid}
      {agenda}

      {selected && (
        <RouteSheet
          title={`${selected.subjects?.name ?? "Lezione"} · ${hhmm(selected.start_min)}–${hhmm(selected.end_min)}`}
          description={longDate(selected.date)}
          closeHref={path}
        >
          <LessonPanel
            lesson={selected}
            tutors={tutors ?? []}
            threshold={settings.cancellationHours}
            path={path}
          />
        </RouteSheet>
      )}
    </>
  );
}

function LessonPanel({
  lesson: l,
  tutors,
  threshold,
  path,
}: {
  lesson: Row;
  tutors: { id: string; first_name: string; last_name: string }[];
  threshold: number;
  path: string;
}) {
  const now = new Date();
  const auto = classifyCancellation(l.date, l.start_min, now, threshold);
  const hidden = (
    <>
      <input type="hidden" name="id" value={l.id} />
      <input type="hidden" name="path" value={path} />
    </>
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-sm">
        <p className="flex flex-wrap gap-1.5">
          <Badge
            tone={
              isCancelled(l.status)
                ? "danger"
                : l.status === "svolta"
                  ? "ok"
                  : "neutral"
            }
          >
            {STATUS_LABEL[l.status]}
          </Badge>
          {l.mode === "online" ? (
            <Badge tone="pervinca">online</Badge>
          ) : (
            l.rooms && <Badge>{l.rooms.name}</Badge>
          )}
          {l.locked && <Badge>bloccata</Badge>}
        </p>
        <dl className="mt-2 grid grid-cols-[90px_1fr] gap-y-2">
          <dt className="text-muted">Tutor</dt>
          <dd>
            <Link
              href={`/persone/tutor/${l.tutor_id}`}
              className="font-semibold text-pervinca-strong hover:underline"
            >
              {l.tutors?.first_name} {l.tutors?.last_name}
            </Link>
          </dd>
          <dt className="text-muted">Studenti</dt>
          <dd>
            {l.lesson_students.map((s, i) => (
              <span key={s.student_id}>
                {i > 0 && ", "}
                <Link
                  href={`/persone/famiglia/${s.students?.family_id}`}
                  className="font-semibold text-pervinca-strong hover:underline"
                >
                  {s.students?.first_name} {s.students?.last_name}
                </Link>
              </span>
            ))}
          </dd>
        </dl>
        {(l.duration_changed || l.violations?.length > 0) && (
          <ul className="mt-2 flex flex-col gap-1 rounded-xl bg-warn/8 p-3 text-xs text-warn">
            {l.duration_changed && <li>Durata adattata dal motore.</li>}
            {l.violations?.map((v) => (
              <li key={v.label}>
                Sovrapposta a «{v.label}» (P{v.priority})
              </li>
            ))}
          </ul>
        )}
        {l.cancellation_reason && (
          <p className="text-xs text-muted">
            Motivo: {l.cancellation_reason}{" "}
            {l.cancelled_by && `(${l.cancelled_by})`}
          </p>
        )}
      </div>

      {l.status === "programmata" && (
        <section className="border-t pt-5 [&>form]:!border-0 [&>form]:!p-0">
          <MoveLessonEntry
            action={moveLesson}
            id={l.id}
            path={path}
            date={l.date}
            time={hhmm(l.start_min)}
            currentTutorId={l.tutor_id}
            tutors={tutors}
          />
        </section>
      )}

      {l.status === "programmata" && (
        <section className="border-t pt-5 [&>form]:!border-0 [&>form]:!p-0">
          <CancelLessonEntry
            action={cancelLesson}
            id={l.id}
            path={path}
            late={auto === "annullata_tardiva"}
            threshold={threshold}
          />
        </section>
      )}

      <section className="flex flex-col gap-3 border-t pt-5">
        <h3 className="label-caps font-sans text-muted">Stato e blocco</h3>
        <SheetForm
          action={setLessonStatus}
          success="Stato aggiornato"
          className="flex gap-2"
        >
          {hidden}
          <label className="sr-only" htmlFor={`st-${l.id}`}>
            Stato della lezione
          </label>
          <Select
            id={`st-${l.id}`}
            name="status"
            defaultValue={l.status}
            className="flex-1"
          >
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="outline">
            Salva
          </Button>
        </SheetForm>
        <SheetForm
          action={toggleLock}
          success={l.locked ? "Lezione sbloccata" : "Lezione bloccata"}
        >
          {hidden}
          <input type="hidden" name="locked" value={l.locked ? "0" : "1"} />
          <Button size="sm" variant="ghost">
            {l.locked ? <Unlock /> : <Lock />}
            {l.locked
              ? "Sblocca: il motore può spostarla"
              : "Blocca: il motore non la sposta"}
          </Button>
        </SheetForm>
      </section>
    </div>
  );
}
