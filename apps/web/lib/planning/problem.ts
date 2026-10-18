/**
 * Dai dati del centro al problema del motore, per un mese.
 *
 * - Le lezioni singole già fissate a mano (o bloccate dopo uno spostamento)
 *   restano dove sono: il motore le vede come impegni rigidi di tutor e studenti.
 * - La collocazione attuale delle lezioni ricorrenti viene passata come
 *   "esistente", così il motore la cambia solo se serve.
 */

import type { LessonStatus } from "@/lib/domain/cancellation";
import { tutorCoversLevel } from "@/lib/domain/levels";
import { monthEnd, monthStart, weekdayOf, type DateStr } from "@/lib/domain/time";

import type { EngineConstraint, EngineProblem, EngineRequest } from "./engine-types";

export interface PlanningData {
  centerHours: { weekday: number; start_min: number; end_min: number }[];
  closures: { date: DateStr }[];
  rooms: { id: string; name: string; capacity: number; active: boolean }[];
  tutors: {
    id: string;
    first_name: string;
    last_name: string;
    modes: ("presenza" | "online")[];
    max_weekly_minutes: number | null;
    max_daily_minutes: number | null;
    active: boolean;
  }[];
  tutorSubjects: { tutor_id: string; subject_id: string; levels: string[] }[];
  availability: { tutor_id: string; weekday: number; start_min: number; end_min: number }[];
  absences: { tutor_id: string; date: DateStr; start_min: number; end_min: number }[];
  students: { id: string; first_name: string; last_name: string; school_level: string; max_lessons_per_day: number | null; active: boolean }[];
  constraints: {
    id: string;
    student_id: string;
    priority: number;
    label: string;
    weekday: number | null;
    date: DateStr | null;
    start_min: number;
    end_min: number;
    valid_from: DateStr | null;
    valid_to: DateStr | null;
  }[];
  requests: {
    id: string;
    kind: "ricorrente" | "singola";
    subject_id: string;
    sessions_per_week: number;
    duration_min: number;
    flexible_duration: boolean;
    mode: "presenza" | "online" | "indifferente";
    preferred_tutor_id: string | null;
    priority: number;
    topic: string | null;
    window_from: DateStr | null;
    window_to: DateStr | null;
    valid_from: DateStr;
    valid_to: DateStr | null;
    status: string;
  }[];
  requestStudents: { request_id: string; student_id: string }[];
  lessons: {
    id: string;
    request_id: string | null;
    session_index: number;
    date: DateStr;
    start_min: number;
    end_min: number;
    tutor_id: string;
    locked: boolean;
    status: LessonStatus;
    student_ids: string[];
  }[];
  weights?: Record<string, unknown>;
}

export function isFixed(l: PlanningData["lessons"][number]): boolean {
  return l.status === "programmata" && (l.locked || l.request_id === null);
}

export function buildProblem(data: PlanningData, month: DateStr, today: DateStr, timeLimitS = 120): EngineProblem {
  const start = monthStart(month) > today ? monthStart(month) : today;
  const end = monthEnd(month);
  const students = data.students.filter((s) => s.active);
  const studentById = new Map(students.map((s) => [s.id, s]));
  const tutors = data.tutors.filter((t) => t.active);

  const fixed = data.lessons.filter((l) => isFixed(l) && l.date >= start && l.date <= end);
  const extraConstraints = new Map<string, EngineConstraint[]>();
  const extraUnavailable = new Map<string, { date: string; start: number; end: number }[]>();
  for (const l of fixed) {
    for (const sid of l.student_ids) {
      const list = extraConstraints.get(sid) ?? [];
      list.push({ id: `fissa-${l.id}`, priority: 1, label: "lezione già fissata", dated: { date: l.date, start: l.start_min, end: l.end_min } });
      extraConstraints.set(sid, list);
    }
    const u = extraUnavailable.get(l.tutor_id) ?? [];
    u.push({ date: l.date, start: l.start_min, end: l.end_min });
    extraUnavailable.set(l.tutor_id, u);
  }

  const studentsOf = new Map<string, string[]>();
  for (const rs of data.requestStudents) {
    if (!studentById.has(rs.student_id)) continue;
    studentsOf.set(rs.request_id, [...(studentsOf.get(rs.request_id) ?? []), rs.student_id]);
  }

  const requests: EngineRequest[] = [];
  for (const r of data.requests) {
    if (r.status !== "attiva") continue;
    const sids = studentsOf.get(r.id) ?? [];
    if (!sids.length) continue;
    if (r.kind === "ricorrente" && (r.valid_from > end || (r.valid_to && r.valid_to < start))) continue;
    if (r.kind === "singola" && ((r.window_to && r.window_to < start) || (r.window_from && r.window_from > end))) continue;
    if (r.kind === "singola" && data.lessons.some((l) => l.request_id === r.id && l.status === "programmata")) continue;
    const levels = sids.map((s) => studentById.get(s)!.school_level).filter(Boolean);
    const tutorIds = tutors
      .filter((t) =>
        data.tutorSubjects.some(
          (ts) => ts.tutor_id === t.id && ts.subject_id === r.subject_id && levels.every((lv) => tutorCoversLevel(ts.levels, lv)),
        ),
      )
      .map((t) => t.id);
    requests.push({
      id: r.id,
      student_ids: sids,
      subject_id: r.subject_id,
      kind: r.kind,
      sessions_per_week: r.kind === "singola" ? 1 : r.sessions_per_week,
      duration: r.duration_min,
      flexible_duration: r.flexible_duration,
      mode: r.mode,
      tutor_ids: tutorIds,
      preferred_tutor_id: r.preferred_tutor_id,
      priority: r.priority,
      level: sids.length === 1 ? studentById.get(sids[0])!.school_level || null : null,
      topic: r.topic,
      window_from: r.window_from,
      window_to: r.window_to,
      existing: r.kind === "ricorrente" ? currentPattern(data.lessons, r.id, r.sessions_per_week) : [],
    });
  }

  return {
    period_start: start,
    period_end: end,
    center: {
      hours: data.centerHours.map((h) => ({ weekday: h.weekday, start: h.start_min, end: h.end_min })),
      closed_dates: data.closures.map((c) => c.date),
      slot_minutes: 30,
    },
    rooms: data.rooms.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, capacity: r.capacity })),
    tutors: tutors.map((t) => ({
      id: t.id,
      name: `${t.first_name} ${t.last_name}`.trim(),
      subjects: data.tutorSubjects.filter((ts) => ts.tutor_id === t.id).map((ts) => ts.subject_id),
      modes: t.modes,
      availability: data.availability
        .filter((a) => a.tutor_id === t.id)
        .map((a) => ({ weekday: a.weekday, start: a.start_min, end: a.end_min })),
      unavailable: [
        ...data.absences.filter((a) => a.tutor_id === t.id).map((a) => ({ date: a.date, start: a.start_min, end: a.end_min })),
        ...(extraUnavailable.get(t.id) ?? []),
      ],
      max_weekly_minutes: t.max_weekly_minutes,
      max_daily_minutes: t.max_daily_minutes,
    })),
    students: students.map((s) => ({
      id: s.id,
      name: s.first_name,
      max_lessons_per_day: s.max_lessons_per_day,
      constraints: [
        ...data.constraints
          .filter((c) => c.student_id === s.id)
          .map<EngineConstraint>((c) => ({
            id: c.id,
            priority: c.priority,
            label: c.label,
            weekly: c.weekday !== null ? { weekday: c.weekday, start: c.start_min, end: c.end_min } : null,
            dated: c.date ? { date: c.date, start: c.start_min, end: c.end_min } : null,
            valid_from: c.valid_from,
            valid_to: c.valid_to,
          })),
        ...(extraConstraints.get(s.id) ?? []),
      ],
    })),
    requests,
    weights: data.weights && Object.keys(data.weights).length ? data.weights : undefined,
    time_limit_s: timeLimitS,
  };
}

/** Collocazione settimanale prevalente di ogni sessione, dalle lezioni non bloccate. */
export function currentPattern(lessons: PlanningData["lessons"], requestId: string, sessions: number) {
  const out: EngineRequest["existing"] = [];
  for (let k = 0; k < sessions; k++) {
    const counts = new Map<string, number>();
    for (const l of lessons) {
      if (l.request_id !== requestId || l.session_index !== k || l.status !== "programmata" || l.locked) continue;
      const key = `${weekdayOf(l.date)}|${l.start_min}|${l.tutor_id}|${l.end_min - l.start_min}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!best) break; // le sessioni successive restano libere
    const [weekday, start, tutor, duration] = best[0].split("|");
    out.push({ weekday: Number(weekday), start: Number(start), tutor_id: tutor, duration: Number(duration), locked: false });
  }
  return out;
}

/** ISO week key "YYYY-Www" per evitare doppioni con lezioni bloccate nella stessa settimana. */
export function weekKey(date: DateStr): string {
  const d = new Date(`${date}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
