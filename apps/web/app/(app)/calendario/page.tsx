import {
  CancelLessonEntry,
  MoveLessonEntry,
} from "@/components/entries/lessons";
import { ChevronLeft, ChevronRight, Lock, Unlock, X } from "lucide-react";
import Link from "next/link";

import {
  cancelLesson,
  markPastDone,
  moveLesson,
  setLessonStatus,
  toggleLock,
} from "@/app/(app)/actions/planning";
import { LiveRefresh } from "@/components/live-refresh";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  cn,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
} from "@/components/ui";
import { sessionClient } from "@/lib/db/clients";
import { loadSettings } from "@/lib/db/repo";
import {
  classifyCancellation,
  hoursBefore,
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

type Search = { w?: string; tutor?: string; lezione?: string };

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

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const db = await sessionClient();
  const today = todayRome();
  const monday = mondayOf(
    /^\d{4}-\d{2}-\d{2}$/.test(sp.w ?? "") ? sp.w! : today,
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

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const all = { w: monday, tutor: sp.tutor, ...extra };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    return `/calendario?${p.toString()}`;
  };
  const path = qs({});
  const pastOpen = lessons.filter(
    (l) => l.status === "programmata" && l.date < today,
  ).length;

  return (
    <>
      <LiveRefresh tables={["lessons"]} />
      <PageHeader
        eyebrow="Calendario"
        title={`Settimana del ${shortDate(monday)}`}
        action={
          <>
            <LinkButton
              href={qs({ w: addDays(monday, -7) })}
              variant="outline"
              size="sm"
              aria-label="Settimana precedente"
            >
              <ChevronLeft />
            </LinkButton>
            <LinkButton href={qs({ w: today })} variant="outline" size="sm">
              Oggi
            </LinkButton>
            <LinkButton
              href={qs({ w: addDays(monday, 7) })}
              variant="outline"
              size="sm"
              aria-label="Settimana successiva"
            >
              <ChevronRight />
            </LinkButton>
          </>
        }
      >
        <form className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="w" value={monday} />
          <Select
            name="tutor"
            defaultValue={sp.tutor ?? ""}
            className="w-auto py-1.5"
          >
            <option value="">Tutti i tutor</option>
            {(tutors ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.first_name} {t.last_name}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="ghost">
            Filtra
          </Button>
        </form>
      </PageHeader>

      {pastOpen > 0 && (
        <form
          action={markPastDone}
          className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-pesca/10 px-4 py-3 text-sm"
        >
          <span className="flex-1">
            {pastOpen} lezioni passate sono ancora «programmate»: contano già
            nei conti, ma puoi segnarle come svolte.
          </span>
          <Button size="sm" variant="outline">
            Segna tutte come svolte
          </Button>
        </form>
      )}

      <div className={cn("grid gap-6", selected && "xl:grid-cols-[1fr_360px]")}>
        <div
          className={cn(
            "grid gap-3",
            visibleDays.length > 6 ? "lg:grid-cols-7" : "lg:grid-cols-6",
          )}
        >
          {visibleDays.map((d) => {
            const dayLessons = lessons.filter((l) => l.date === d);
            return (
              <section key={d} className="min-w-0">
                <p
                  className={cn(
                    "label-caps mb-2 flex items-baseline gap-2",
                    d === today ? "text-pesca" : "text-muted",
                  )}
                >
                  {WEEKDAYS_SHORT[weekdayOf(d)]}{" "}
                  <span className="font-serif text-lg normal-case tracking-normal text-ink">
                    {Number(d.slice(8))}
                  </span>
                </p>
                <div className="flex flex-col gap-2">
                  {dayLessons.map((l) => (
                    <Link
                      key={l.id}
                      href={qs({ lezione: l.id })}
                      scroll={false}
                      className={cn(
                        "block rounded-xl border-l-4 bg-surface p-2.5 text-xs shadow-sm transition hover:shadow-md",
                        l.mode === "online"
                          ? "border-pervinca"
                          : "border-pesca",
                        isCancelled(l.status) &&
                          "opacity-50 line-through decoration-ink/30",
                        l.id === selected?.id && "ring-2 ring-pervinca",
                      )}
                    >
                      <p className="flex items-center gap-1 font-semibold tabular-nums">
                        {hhmm(l.start_min)}–{hhmm(l.end_min)}
                        {l.locked && <Lock className="size-3 text-muted" />}
                        {(l.violations?.length > 0 || l.duration_changed) && (
                          <span
                            className="ml-auto size-2 rounded-full bg-warn"
                            title="Segnalazioni del motore"
                          />
                        )}
                      </p>
                      <p className="truncate">
                        {l.lesson_students
                          .map((s) => s.students?.first_name)
                          .join(", ")}
                      </p>
                      <p className="truncate text-muted">
                        {l.subjects?.name} · {l.tutors?.first_name}
                      </p>
                    </Link>
                  ))}
                  {!dayLessons.length && (
                    <p className="rounded-xl border border-dashed px-2 py-3 text-center text-xs text-muted">
                      —
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {selected && (
          <LessonPanel
            lesson={selected}
            tutors={tutors ?? []}
            threshold={settings.cancellationHours}
            path={path}
            closeHref={path}
          />
        )}
      </div>
    </>
  );
}

function LessonPanel({
  lesson: l,
  tutors,
  threshold,
  path,
  closeHref,
}: {
  lesson: Row;
  tutors: { id: string; first_name: string; last_name: string }[];
  threshold: number;
  path: string;
  closeHref: string;
}) {
  const now = new Date();
  const auto = classifyCancellation(l.date, l.start_min, now, threshold);
  const hrs = hoursBefore(l.date, l.start_min, now);
  const hidden = (
    <>
      <input type="hidden" name="id" value={l.id} />
      <input type="hidden" name="path" value={path} />
    </>
  );
  return (
    <Card className="h-fit xl:sticky xl:top-6">
      <CardHeader
        title={`${l.subjects?.name ?? "Lezione"} · ${hhmm(l.start_min)}`}
        subtitle={longDate(l.date)}
        action={
          <Link
            href={closeHref}
            scroll={false}
            className="rounded-full p-1 hover:bg-ink/5"
            aria-label="Chiudi"
          >
            <X className="size-4" />
          </Link>
        }
      />
      <div className="flex flex-col gap-2 p-5 text-sm">
        <p>
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
          </Badge>{" "}
          {l.mode === "online" ? (
            <Badge tone="pervinca">online</Badge>
          ) : (
            l.rooms && <Badge>{l.rooms.name}</Badge>
          )}
        </p>
        <p>
          <span className="text-muted">Tutor:</span>{" "}
          <Link
            href={`/persone/tutor/${l.tutor_id}`}
            className="font-medium hover:underline"
          >
            {l.tutors?.first_name} {l.tutors?.last_name}
          </Link>
        </p>
        <p>
          <span className="text-muted">Studenti:</span>{" "}
          {l.lesson_students.map((s, i) => (
            <span key={s.student_id}>
              {i > 0 && ", "}
              <Link
                href={`/persone/famiglia/${s.students?.family_id}`}
                className="font-medium hover:underline"
              >
                {s.students?.first_name} {s.students?.last_name}
              </Link>
            </span>
          ))}
        </p>
        {l.duration_changed && (
          <p className="text-xs text-pesca-deep">Durata adattata dal motore.</p>
        )}
        {l.violations?.map((v) => (
          <p key={v.label} className="text-xs text-warn">
            Sovrapposta a «{v.label}» (P{v.priority})
          </p>
        ))}
        {l.cancellation_reason && (
          <p className="text-xs text-muted">
            Motivo: {l.cancellation_reason}{" "}
            {l.cancelled_by && `(${l.cancelled_by})`}
          </p>
        )}
      </div>

      {l.status === "programmata" && (
        <div className="flex flex-col gap-3 border-t p-5">
          <CancelLessonEntry
            action={cancelLesson}
            id={l.id}
            path={path}
            late={auto === "annullata_tardiva"}
            threshold={threshold}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 border-t p-5">
        <p className="label-caps text-muted">Stato</p>
        <form action={setLessonStatus} className="flex gap-2">
          {hidden}
          <Select name="status" defaultValue={l.status} className="flex-1">
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="outline">
            Salva
          </Button>
        </form>
      </div>

      {l.status === "programmata" && (
        <MoveLessonEntry
          action={moveLesson}
          id={l.id}
          path={path}
          date={l.date}
          time={hhmm(l.start_min)}
          currentTutorId={l.tutor_id}
          tutors={tutors}
        />
      )}

      <form action={toggleLock} className="border-t p-5">
        {hidden}
        <input type="hidden" name="locked" value={l.locked ? "0" : "1"} />
        <Button size="sm" variant="ghost">
          {l.locked ? <Unlock /> : <Lock />}
          {l.locked
            ? "Sblocca: il motore può spostarla"
            : "Blocca: il motore non la sposta"}
        </Button>
      </form>
    </Card>
  );
}
