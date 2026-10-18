"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/staff";
import { audit } from "@/lib/db/actions";
import { sessionClient } from "@/lib/db/clients";
import { parseHhmm } from "@/lib/domain/time";
import { normalizePhone } from "@/lib/whatsapp/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => str(fd, k) || null;
const int = (fd: FormData, k: string) => (str(fd, k) === "" ? null : Math.round(Number(str(fd, k).replace(",", "."))));
const cents = (fd: FormData, k: string) => (str(fd, k) === "" ? null : Math.round(Number(str(fd, k).replace(",", ".")) * 100));
const phone = (fd: FormData, k: string) => (str(fd, k) ? normalizePhone(str(fd, k)) : null);
const time = (fd: FormData, k: string, fallback: number) => parseHhmm(str(fd, k)) ?? fallback;

async function ctx() {
  const staff = await requireStaff();
  return { staff, db: await sessionClient() };
}

function check(res: { error: { message: string } | null }) {
  if (res.error) throw new Error(res.error.message);
}

// ------------------------------------------------------------ famiglie

export async function createFamily(fd: FormData) {
  const { db, staff } = await ctx();
  const fam = await db.from("families").insert({ name: str(fd, "family_name") }).select("id").single();
  check(fam);
  const familyId = fam.data!.id;
  if (str(fd, "parent_first_name")) {
    check(
      await db.from("parents").insert({
        family_id: familyId,
        first_name: str(fd, "parent_first_name"),
        last_name: str(fd, "parent_last_name"),
        phone: phone(fd, "parent_phone"),
        is_primary: true,
      }),
    );
  }
  if (str(fd, "student_first_name")) {
    check(
      await db.from("students").insert({
        family_id: familyId,
        first_name: str(fd, "student_first_name"),
        last_name: str(fd, "student_last_name") || str(fd, "parent_last_name"),
        school_level: str(fd, "school_level"),
      }),
    );
  }
  await audit(db, staff.userId, "crea_famiglia", "families", familyId, {});
  redirect(`/persone/famiglia/${familyId}`);
}

export async function updateFamily(fd: FormData) {
  const { db } = await ctx();
  const id = str(fd, "id");
  check(
    await db
      .from("families")
      .update({
        name: str(fd, "name"),
        notes: str(fd, "notes"),
        minors_contact_consent: fd.get("minors_contact_consent") === "on",
        privacy_consent_at: fd.get("privacy_consent") === "on" ? new Date().toISOString() : null,
      })
      .eq("id", id),
  );
  revalidatePath(`/persone/famiglia/${id}`);
}

export async function upsertParent(fd: FormData) {
  const { db } = await ctx();
  const row = {
    family_id: str(fd, "family_id"),
    first_name: str(fd, "first_name"),
    last_name: str(fd, "last_name"),
    phone: phone(fd, "phone"),
    email: opt(fd, "email"),
  };
  const id = str(fd, "id");
  check(id ? await db.from("parents").update(row).eq("id", id) : await db.from("parents").insert(row));
  revalidatePath(`/persone/famiglia/${row.family_id}`);
}

export async function upsertStudent(fd: FormData) {
  const { db } = await ctx();
  const row = {
    family_id: str(fd, "family_id"),
    first_name: str(fd, "first_name"),
    last_name: str(fd, "last_name"),
    school_level: str(fd, "school_level"),
    phone: phone(fd, "phone"),
    hourly_rate_cents: cents(fd, "hourly_rate"),
    group_hourly_rate_cents: cents(fd, "group_hourly_rate"),
    max_lessons_per_day: int(fd, "max_lessons_per_day"),
  };
  const id = str(fd, "id");
  check(id ? await db.from("students").update(row).eq("id", id) : await db.from("students").insert(row));
  revalidatePath(`/persone/famiglia/${row.family_id}`);
}

export async function deletePerson(fd: FormData) {
  const { db, staff } = await ctx();
  const table = str(fd, "table");
  if (!["parents", "students"].includes(table)) return;
  const id = str(fd, "id");
  // gli studenti restano nello storico (lezioni e conti), i genitori si possono eliminare
  check(table === "students" ? await db.from("students").update({ active: false }).eq("id", id) : await db.from("parents").delete().eq("id", id));
  await audit(db, staff.userId, "rimuovi", table, id, {});
  revalidatePath(`/persone/famiglia/${str(fd, "family_id")}`);
}

// ------------------------------------------------------------ vincoli e richieste

export async function addConstraint(fd: FormData) {
  const { db } = await ctx();
  const date = opt(fd, "date");
  const allDay = fd.get("all_day") === "on";
  check(
    await db.from("student_constraints").insert({
      student_id: str(fd, "student_id"),
      priority: int(fd, "priority") ?? 2,
      category: str(fd, "category") || "altro",
      label: str(fd, "label"),
      weekday: date ? null : int(fd, "weekday"),
      date,
      start_min: allDay ? 0 : time(fd, "start", 0),
      end_min: allDay ? 1440 : time(fd, "end", 1440),
      valid_to: opt(fd, "valid_to"),
      source: "coordinatore",
      priority_confirmed: true,
    }),
  );
  revalidatePath(`/persone/famiglia/${str(fd, "family_id")}`);
}

export async function updateConstraint(fd: FormData) {
  const { db } = await ctx();
  const id = str(fd, "id");
  if (fd.get("delete") === "1") check(await db.from("student_constraints").delete().eq("id", id));
  else check(await db.from("student_constraints").update({ priority: int(fd, "priority"), priority_confirmed: true }).eq("id", id));
  revalidatePath(`/persone/famiglia/${str(fd, "family_id")}`);
}

export async function addRequest(fd: FormData) {
  const { db } = await ctx();
  const studentIds = fd.getAll("student_ids").map(String).filter(Boolean);
  const req = await db
    .from("lesson_requests")
    .insert({
      kind: str(fd, "kind") || "ricorrente",
      subject_id: str(fd, "subject_id"),
      sessions_per_week: int(fd, "sessions_per_week") ?? 1,
      duration_min: int(fd, "duration_min") ?? 60,
      flexible_duration: fd.get("flexible_duration") === "on",
      mode: str(fd, "mode") || "presenza",
      preferred_tutor_id: opt(fd, "preferred_tutor_id"),
      priority: int(fd, "priority") ?? 2,
      topic: opt(fd, "topic"),
      window_from: opt(fd, "window_from"),
      window_to: opt(fd, "window_to"),
      status: "attiva",
      source: "coordinatore",
    })
    .select("id")
    .single();
  check(req);
  check(await db.from("lesson_request_students").insert(studentIds.map((sid) => ({ request_id: req.data!.id, student_id: sid }))));
  revalidatePath(`/persone/famiglia/${str(fd, "family_id")}`);
}

export async function setRequestStatus(fd: FormData) {
  const { db, staff } = await ctx();
  const status = str(fd, "status");
  if (!["attiva", "sospesa", "chiusa"].includes(status)) return;
  check(
    await db
      .from("lesson_requests")
      .update({ status, ...(status === "attiva" ? { approved_by: staff.userId, approved_at: new Date().toISOString() } : {}) })
      .eq("id", str(fd, "id")),
  );
  revalidatePath(`/persone/famiglia/${str(fd, "family_id")}`);
  revalidatePath("/piano");
}

// ------------------------------------------------------------ tutor

export async function upsertTutor(fd: FormData) {
  const { db } = await ctx();
  const modes = fd.getAll("modes").map(String);
  const row = {
    first_name: str(fd, "first_name"),
    last_name: str(fd, "last_name"),
    phone: phone(fd, "phone"),
    email: opt(fd, "email"),
    modes: modes.length ? modes : ["presenza"],
    hourly_rate_cents: cents(fd, "hourly_rate") ?? 0,
    group_hourly_rate_cents: cents(fd, "group_hourly_rate"),
    max_weekly_minutes: int(fd, "max_weekly_hours") !== null ? int(fd, "max_weekly_hours")! * 60 : null,
    max_daily_minutes: int(fd, "max_daily_hours") !== null ? int(fd, "max_daily_hours")! * 60 : null,
    active: fd.get("active") !== "off",
  };
  const id = str(fd, "id");
  if (id) {
    check(await db.from("tutors").update(row).eq("id", id));
    revalidatePath(`/persone/tutor/${id}`);
  } else {
    const res = await db.from("tutors").insert(row).select("id").single();
    check(res);
    redirect(`/persone/tutor/${res.data!.id}`);
  }
}

export async function setTutorSubject(fd: FormData) {
  const { db } = await ctx();
  const tutorId = str(fd, "tutor_id");
  const subjectId = str(fd, "subject_id");
  if (fd.get("delete") === "1") {
    check(await db.from("tutor_subjects").delete().eq("tutor_id", tutorId).eq("subject_id", subjectId));
  } else {
    const levels = str(fd, "levels").split(",").map((s) => s.trim()).filter(Boolean);
    check(await db.from("tutor_subjects").upsert({ tutor_id: tutorId, subject_id: subjectId, levels }));
  }
  revalidatePath(`/persone/tutor/${tutorId}`);
}

export async function addAvailability(fd: FormData) {
  const { db } = await ctx();
  const tutorId = str(fd, "tutor_id");
  const days = fd.getAll("weekday").map(Number);
  const start = time(fd, "start", 15 * 60);
  const end = time(fd, "end", 19 * 60);
  if (end <= start || !days.length) return;
  check(await db.from("tutor_availability").insert(days.map((weekday) => ({ tutor_id: tutorId, weekday, start_min: start, end_min: end }))));
  revalidatePath(`/persone/tutor/${tutorId}`);
}

export async function removeRow(fd: FormData) {
  const { db } = await ctx();
  const table = str(fd, "table");
  if (!["tutor_availability", "tutor_absences", "family_payments", "tutor_payouts"].includes(table)) return;
  check(await db.from(table).delete().eq("id", str(fd, "id")));
  revalidatePath(str(fd, "path") || "/persone");
}

export async function addAbsence(fd: FormData) {
  const { db } = await ctx();
  const tutorId = str(fd, "tutor_id");
  const allDay = fd.get("all_day") === "on";
  check(
    await db.from("tutor_absences").insert({
      tutor_id: tutorId,
      date: str(fd, "date"),
      start_min: allDay ? 0 : time(fd, "start", 0),
      end_min: allDay ? 1440 : time(fd, "end", 1440),
      note: str(fd, "note"),
    }),
  );
  revalidatePath(`/persone/tutor/${tutorId}`);
}

// ------------------------------------------------------------ pagamenti (contanti)

export async function addFamilyPayment(fd: FormData) {
  const { db, staff } = await ctx();
  const amount = cents(fd, "amount");
  if (!amount || amount <= 0) return;
  check(
    await db.from("family_payments").insert({
      family_id: str(fd, "family_id"),
      amount_cents: amount,
      paid_on: str(fd, "paid_on") || undefined,
      period_month: str(fd, "period_month"),
      note: str(fd, "note"),
      recorded_by: staff.userId,
    }),
  );
  revalidatePath("/conti");
  revalidatePath(`/persone/famiglia/${str(fd, "family_id")}`);
}

export async function addTutorPayout(fd: FormData) {
  const { db, staff } = await ctx();
  const amount = cents(fd, "amount");
  if (!amount || amount <= 0) return;
  check(
    await db.from("tutor_payouts").insert({
      tutor_id: str(fd, "tutor_id"),
      amount_cents: amount,
      paid_on: str(fd, "paid_on") || undefined,
      period_month: str(fd, "period_month"),
      note: str(fd, "note"),
      recorded_by: staff.userId,
    }),
  );
  revalidatePath("/conti");
  revalidatePath(`/persone/tutor/${str(fd, "tutor_id")}`);
}
