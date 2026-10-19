import "server-only";

import { audit } from "@/lib/db/actions";
import type { Json } from "@/lib/db/types";
import { asJson, must, type Db } from "@/lib/db/util";
import { monthEnd, monthStart, todayRome, type DateStr } from "@/lib/domain/time";

import type { EngineProblem, EngineSolution } from "./engine-types";
import { buildProblem, isFixed, weekKey, type PlanningData } from "./problem";

export async function loadPlanningData(db: Db, month: DateStr): Promise<PlanningData> {
  const from = monthStart(month);
  const to = monthEnd(month);
  const q = async <T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, what: string) => must(await p, what);
  const [centerHours, closures, rooms, tutors, tutorSubjects, availability, absences, students, constraints, requests, requestStudents, lessonRows, weights] =
    await Promise.all([
      q(db.from("center_hours").select("weekday, start_min, end_min"), "orari"),
      q(db.from("center_closures").select("date").gte("date", from).lte("date", to), "chiusure"),
      q(db.from("rooms").select("id, name, capacity, active"), "postazioni"),
      q(db.from("tutors").select("id, first_name, last_name, modes, max_weekly_minutes, max_daily_minutes, active"), "tutor"),
      q(db.from("tutor_subjects").select("tutor_id, subject_id, levels"), "materie tutor"),
      q(db.from("tutor_availability").select("tutor_id, weekday, start_min, end_min"), "disponibilità"),
      q(db.from("tutor_absences").select("tutor_id, date, start_min, end_min").gte("date", from).lte("date", to), "assenze"),
      q(db.from("students").select("id, first_name, last_name, school_level, max_lessons_per_day, active"), "studenti"),
      q(
        db
          .from("student_constraints")
          .select("id, student_id, priority, label, weekday, date, start_min, end_min, valid_from, valid_to"),
        "vincoli",
      ),
      q(db.from("lesson_requests").select("*").in("status", ["attiva"]), "richieste"),
      q(db.from("lesson_request_students").select("request_id, student_id"), "richieste-studenti"),
      q(
        db
          .from("lessons")
          .select("id, request_id, session_index, date, start_min, end_min, tutor_id, locked, status, lesson_students(student_id)")
          .gte("date", from)
          .lte("date", to),
        "lezioni",
      ),
      q(db.from("settings").select("value").eq("key", "engine_weights").maybeSingle(), "pesi"),
    ]);
  type L = PlanningData["lessons"][number] & { lesson_students: { student_id: string }[] };
  return {
    centerHours: centerHours as PlanningData["centerHours"],
    closures: closures as PlanningData["closures"],
    rooms: rooms as PlanningData["rooms"],
    tutors: tutors as PlanningData["tutors"],
    tutorSubjects: tutorSubjects as PlanningData["tutorSubjects"],
    availability: availability as PlanningData["availability"],
    absences: absences as PlanningData["absences"],
    students: students as PlanningData["students"],
    constraints: constraints as PlanningData["constraints"],
    requests: requests as PlanningData["requests"],
    requestStudents: requestStudents as PlanningData["requestStudents"],
    lessons: (lessonRows as L[]).map((l) => ({ ...l, student_ids: l.lesson_students.map((s) => s.student_id) })),
    weights: ((weights as { value?: Record<string, unknown> } | null)?.value ?? {}) as Record<string, unknown>,
  };
}

export async function callEngine(problem: EngineProblem): Promise<EngineSolution> {
  const url = process.env.ENGINE_URL;
  const token = process.env.ENGINE_TOKEN;
  if (!url || !token) throw new Error("motore non configurato (ENGINE_URL, ENGINE_TOKEN)");
  const res = await fetch(`${url.replace(/\/$/, "")}/solve`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(problem),
    signal: AbortSignal.timeout(((problem.time_limit_s ?? 60) + 60) * 1000),
  });
  if (!res.ok) throw new Error(`motore ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return (await res.json()) as EngineSolution;
}

/**
 * Crea una bozza di piano per il mese e restituisce il suo id. Il calcolo
 * (fino a qualche minuto) va lanciato con `solvePlanningRun`, di solito in
 * background: la pagina mostra la bozza "in calcolo" finché non arriva la soluzione.
 * Il calendario non cambia finché la bozza non viene confermata.
 */
export async function startPlanningRun(db: Db, month: DateStr, staffId: string | null): Promise<string> {
  const data = await loadPlanningData(db, month);
  const problem = buildProblem(data, month, todayRome(), Number(process.env.PLANNING_TIME_LIMIT_S) || 120);
  const run = must(
    await db
      .from("planning_runs")
      .insert({ month: monthStart(month), status: "bozza", problem: problem as unknown as Json, created_by: staffId })
      .select("id")
      .single(),
    "piano",
  ) as { id: string };
  return run.id;
}

export async function solvePlanningRun(db: Db, runId: string): Promise<void> {
  const run = must(await db.from("planning_runs").select("problem").eq("id", runId).single(), "piano") as { problem: EngineProblem };
  try {
    const solution = await callEngine(run.problem);
    must(await db.from("planning_runs").update({ solution: solution as unknown as Json }).eq("id", runId), "salvataggio piano");
  } catch (e) {
    await db.from("planning_runs").update({ status: "errore", error: String(e).slice(0, 1000) }).eq("id", runId);
  }
}

/**
 * Conferma: sostituisce le lezioni future non bloccate del mese con quelle del
 * piano. Le lezioni fissate a mano o bloccate restano; nelle loro settimane la
 * stessa sessione non viene duplicata.
 */
export async function confirmPlanningRun(db: Db, runId: string, staffId: string | null): Promise<{ inserted: number; removed: number }> {
  const run = must(await db.from("planning_runs").select("*").eq("id", runId).single(), "piano") as {
    id: string;
    month: string;
    status: string;
    solution: EngineSolution | null;
  };
  if (run.status !== "bozza" || !run.solution) throw new Error("il piano non è una bozza confermabile");
  const today = todayRome();
  const data = await loadPlanningData(db, run.month);
  const kept = data.lessons.filter((l) => isFixed(l) && l.date >= today);
  const keptKeys = new Set(kept.filter((l) => l.request_id).map((l) => `${l.request_id}|${l.session_index}|${weekKey(l.date)}`));
  const toRemove = data.lessons.filter((l) => l.status === "programmata" && !isFixed(l) && l.date >= today).map((l) => l.id);

  const occurrences = run.solution.occurrences.filter(
    (o) => o.date >= today && !keptKeys.has(`${o.request_id}|${o.session_index}|${weekKey(o.date)}`),
  );
  if (toRemove.length) must(await db.from("lessons").delete().in("id", toRemove), "rimozione lezioni");
  let inserted = 0;
  for (let i = 0; i < occurrences.length; i += 200) {
    const chunk = occurrences.slice(i, i + 200);
    const rows = must(
      await db
        .from("lessons")
        .insert(
          chunk.map((o) => ({
            request_id: o.request_id,
            session_index: o.session_index,
            run_id: run.id,
            subject_id: o.subject_id,
            tutor_id: o.tutor_id,
            room_id: o.room_id,
            date: o.date,
            start_min: o.start,
            end_min: o.end,
            mode: o.mode,
            duration_changed: o.duration_changed,
            relocated: o.relocated,
            violations: asJson(o.violations),
          })),
        )
        .select("id"),
      "inserimento lezioni",
    ) as { id: string }[];
    must(
      await db.from("lesson_students").insert(rows.flatMap((r, j) => chunk[j].student_ids.map((sid) => ({ lesson_id: r.id, student_id: sid })))),
      "studenti lezioni",
    );
    inserted += rows.length;
  }
  must(
    await db.from("planning_runs").update({ status: "scartato" }).eq("month", run.month).eq("status", "bozza").neq("id", run.id),
    "piani precedenti",
  );
  must(
    await db.from("planning_runs").update({ status: "confermato", confirmed_at: new Date().toISOString() }).eq("id", run.id),
    "conferma piano",
  );
  await audit(db, staffId ?? "coordinatore", "conferma_piano", "planning_runs", run.id, { inserted, removed: toRemove.length });
  return { inserted, removed: toRemove.length };
}
