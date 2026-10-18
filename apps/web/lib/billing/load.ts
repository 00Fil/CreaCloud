import "server-only";

import { familyStatement, tutorStatement, type BillingLesson, type Rates } from "@/lib/domain/billing";
import type { LessonStatus } from "@/lib/domain/cancellation";
import { monthEnd, monthStart, todayRome, type DateStr } from "@/lib/domain/time";
import type { Db } from "@/lib/db/util";

export async function loadRates(db: Db): Promise<Rates> {
  const { data } = await db.from("settings").select("key, value");
  const m = Object.fromEntries((data ?? []).map((r) => [r.key, Number(r.value)]));
  return {
    defaultHourly: m.default_hourly_rate_cents ?? 2000,
    defaultGroupHourly: m.default_group_hourly_rate_cents ?? 1500,
    defaultTutorHourly: m.default_tutor_hourly_rate_cents ?? 1200,
    defaultTutorGroupHourly: m.default_tutor_group_hourly_rate_cents ?? 1500,
  };
}

type Row = {
  id: string;
  date: string;
  start_min: number;
  end_min: number;
  status: LessonStatus;
  tutor_id: string;
  lesson_students: { student_id: string }[];
};

async function lessonsBetween(db: Db, from: DateStr, to: DateStr): Promise<BillingLesson[]> {
  const out: BillingLesson[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await db
      .from("lessons")
      .select("id, date, start_min, end_min, status, tutor_id, lesson_students(student_id)")
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Row[]) {
      out.push({
        id: r.id,
        date: r.date,
        startMin: r.start_min,
        endMin: r.end_min,
        status: r.status,
        tutorId: r.tutor_id,
        studentIds: r.lesson_students.map((s) => s.student_id),
      });
    }
    if (!data || data.length < 1000) return out;
  }
}

/** Estratti conto del mese per tutte le famiglie e tutti i tutor. */
export async function monthStatements(db: Db, month: DateStr) {
  const from = monthStart(month);
  const to = monthEnd(month);
  const today = todayRome();
  const [rates, lessons, families, students, tutors, payments, payouts] = await Promise.all([
    loadRates(db),
    lessonsBetween(db, from, to),
    db.from("families").select("id, name, active").order("name"),
    db.from("students").select("id, family_id, first_name, last_name, hourly_rate_cents, group_hourly_rate_cents"),
    db.from("tutors").select("id, first_name, last_name, hourly_rate_cents, group_hourly_rate_cents, active").order("last_name"),
    db.from("family_payments").select("family_id, amount_cents").eq("period_month", from),
    db.from("tutor_payouts").select("tutor_id, amount_cents").eq("period_month", from),
  ]);
  const studentRows = students.data ?? [];
  const fam = (families.data ?? []).map((f) => {
    const kids = studentRows.filter((s) => s.family_id === f.id);
    const ids = new Set(kids.map((k) => k.id));
    const st = familyStatement(
      kids.map((k) => ({ id: k.id, hourlyRateCents: k.hourly_rate_cents, groupHourlyRateCents: k.group_hourly_rate_cents })),
      lessons.filter((l) => l.studentIds.some((s) => ids.has(s))),
      (payments.data ?? []).filter((p) => p.family_id === f.id).map((p) => p.amount_cents),
      rates,
      today,
    );
    return { family: f, students: kids, statement: st };
  });
  const tut = (tutors.data ?? []).map((t) => ({
    tutor: t,
    statement: tutorStatement(
      { id: t.id, hourlyRateCents: t.hourly_rate_cents, groupHourlyRateCents: t.group_hourly_rate_cents },
      lessons,
      (payouts.data ?? []).filter((p) => p.tutor_id === t.id).map((p) => p.amount_cents),
      rates,
      today,
    ),
  }));
  return { families: fam, tutors: tut, rates };
}
