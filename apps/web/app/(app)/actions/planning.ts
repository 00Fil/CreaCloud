"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { lessonText } from "@/lib/agent/decide";
import { requireStaff } from "@/lib/auth/staff";
import { sendToChat } from "@/lib/chat/send";
import { applyAction, audit } from "@/lib/db/actions";
import { serviceClient, sessionClient } from "@/lib/db/clients";
import { LESSON_SELECT, loadSettings, toLessonInfo } from "@/lib/db/repo";
import { classifyCancellation, type LessonStatus } from "@/lib/domain/cancellation";
import { monthEnd, monthLabel, monthStart, parseHhmm, todayRome } from "@/lib/domain/time";
import type { EngineSolution, GroupSuggestion } from "@/lib/planning/engine-types";
import { confirmPlanningRun, solvePlanningRun, startPlanningRun } from "@/lib/planning/run";
import { ensureChat } from "@/lib/whatsapp/ingest";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ------------------------------------------------------------ piano mensile

export async function startPlan(fd: FormData) {
  const staff = await requireStaff();
  const db = await sessionClient();
  const month = monthStart(str(fd, "month") || todayRome());
  const id = await startPlanningRun(db, month, staff.userId);
  // il calcolo dura fino a qualche minuto: la pagina si aggiorna da sola quando finisce
  after(() => solvePlanningRun(serviceClient(), id));
  redirect(`/piano?run=${id}`);
}

export async function confirmPlan(fd: FormData) {
  const staff = await requireStaff();
  const db = await sessionClient();
  const id = str(fd, "run_id");
  const res = await confirmPlanningRun(db, id, staff.userId);
  revalidatePath("/calendario");
  redirect(`/piano?run=${id}&confermato=${res.inserted}`);
}

export async function discardPlan(fd: FormData) {
  await requireStaff();
  const db = await sessionClient();
  await db.from("planning_runs").update({ status: "scartato" }).eq("id", str(fd, "run_id")).eq("status", "bozza");
  redirect("/piano");
}

/**
 * Approva un gruppo suggerito dal motore: crea una richiesta di gruppo con gli
 * studenti coinvolti e sospende le loro richieste individuali di quella materia.
 */
export async function approveGroup(fd: FormData) {
  const staff = await requireStaff();
  const db = await sessionClient();
  const run = await db.from("planning_runs").select("solution").eq("id", str(fd, "run_id")).single();
  const suggestion = (run.data?.solution as EngineSolution | null)?.group_suggestions?.[Number(str(fd, "index"))] as GroupSuggestion | undefined;
  if (!suggestion) return;
  const { data: originals } = await db.from("lesson_requests").select("sessions_per_week, duration_min, mode, priority").in("id", suggestion.request_ids);
  const base = originals ?? [];
  const sessions = Math.max(1, Math.min(...base.map((r) => r.sessions_per_week)));
  const duration = Math.max(...base.map((r) => r.duration_min), 60);
  const mode = base.every((r) => r.mode === "online") ? "online" : base.some((r) => r.mode === "presenza") ? "presenza" : "indifferente";
  const req = await db
    .from("lesson_requests")
    .insert({
      kind: "ricorrente",
      subject_id: suggestion.subject_id,
      sessions_per_week: sessions,
      duration_min: duration,
      mode,
      priority: Math.min(...base.map((r) => r.priority), 2),
      topic: suggestion.topic,
      status: "attiva",
      approved_by: staff.userId,
      approved_at: new Date().toISOString(),
      notes: "Gruppo suggerito dal motore",
      source: "coordinatore",
    })
    .select("id")
    .single();
  if (req.error) throw new Error(req.error.message);
  await db.from("lesson_request_students").insert(suggestion.student_ids.map((sid) => ({ request_id: req.data.id, student_id: sid })));
  await db.from("lesson_requests").update({ status: "sospesa" }).in("id", suggestion.request_ids);
  await audit(db, staff.userId, "approva_gruppo", "lesson_requests", req.data.id, { from: suggestion.request_ids });
  revalidatePath("/piano");
}

/** Invia a ogni famiglia e a ogni tutor gli orari del mese (lezioni future). */
export async function sendSchedules(fd: FormData) {
  await requireStaff();
  const db = await sessionClient();
  const month = monthStart(str(fd, "month") || todayRome());
  const today = todayRome();
  const from = today > month ? today : month;
  const target = str(fd, "target");
  const { data: rows } = await db
    .from("lessons")
    .select(LESSON_SELECT)
    .eq("status", "programmata")
    .gte("date", from)
    .lte("date", monthEnd(month))
    .order("date")
    .order("start_min");
  const lessons = ((rows ?? []) as unknown as Parameters<typeof toLessonInfo>[0][]).map(toLessonInfo);
  const label = monthLabel(month);
  let sent = 0;
  let failed = 0;
  const deliver = async (phone: string | null, name: string, text: string) => {
    if (!phone) return;
    try {
      const chat = await ensureChat(serviceClient(), phone, name);
      await sendToChat(chat.id, text, "coordinatore");
      sent++;
    } catch {
      failed++;
    }
  };

  if (target !== "tutor") {
    const { data: students } = await db.from("students").select("id, family_id, first_name").eq("active", true);
    const { data: parents } = await db.from("parents").select("family_id, first_name, last_name, phone, is_primary").not("phone", "is", null);
    const byFamily = new Map<string, { first_name: string; id: string }[]>();
    for (const s of students ?? []) byFamily.set(s.family_id, [...(byFamily.get(s.family_id) ?? []), s]);
    for (const [familyId, kids] of byFamily) {
      const parent = (parents ?? []).filter((p) => p.family_id === familyId).sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
      const blocks = kids
        .map((k) => {
          const ls = lessons.filter((l) => l.student_ids.includes(k.id));
          return ls.length ? `*${k.first_name}*\n${ls.map((l) => `• ${lessonText(l, false)}`).join("\n")}` : "";
        })
        .filter(Boolean);
      if (!parent || !blocks.length) continue;
      await deliver(parent.phone, `${parent.first_name} ${parent.last_name}`, `Buongiorno ${parent.first_name}, ecco le lezioni di ${label}:\n\n${blocks.join("\n\n")}\n\nPer cambi o annullamenti basta scrivere qui.`);
    }
  }
  if (target !== "famiglie") {
    const { data: tutors } = await db.from("tutors").select("id, first_name, last_name, phone").eq("active", true).not("phone", "is", null);
    for (const t of tutors ?? []) {
      const ls = lessons.filter((l) => l.tutor_id === t.id);
      if (!ls.length) continue;
      const list = ls.map((l) => `• ${lessonText(l).replace(` con ${l.tutor_name}`, "")}`).join("\n");
      await deliver(t.phone, `${t.first_name} ${t.last_name}`, `Ciao ${t.first_name}, ecco le tue lezioni di ${label}:\n\n${list}`);
    }
  }
  redirect(`/piano?inviati=${sent}&errori=${failed}`);
}

// ------------------------------------------------------------ singola lezione

async function lessonCtx() {
  const staff = await requireStaff();
  return { staff, db: await sessionClient() };
}

function refresh(fd: FormData) {
  revalidatePath("/calendario");
  revalidatePath("/");
  const back = str(fd, "path");
  if (back) revalidatePath(back);
}

/** Annulla applicando la regola del preavviso; "senza compenso" solo per scelta del coordinatore. */
export async function cancelLesson(fd: FormData) {
  const { db, staff } = await lessonCtx();
  const { data: lesson } = await db.from("lessons").select("date, start_min").eq("id", str(fd, "id")).single();
  if (!lesson) return;
  const settings = await loadSettings(db);
  const status: LessonStatus =
    str(fd, "kind") === "senza_compenso"
      ? "annullata_senza_compenso"
      : str(fd, "kind") === "in_tempo"
        ? "annullata_in_tempo"
        : classifyCancellation(lesson.date, lesson.start_min, new Date(), settings.cancellationHours);
  await applyAction(db, { type: "annulla_lezione", lessonId: str(fd, "id"), status, reason: str(fd, "reason"), by: "coordinatore" }, staff.userId);
  refresh(fd);
}

export async function setLessonStatus(fd: FormData) {
  const { db, staff } = await lessonCtx();
  const status = str(fd, "status");
  const allowed = ["programmata", "svolta", "annullata_in_tempo", "annullata_tardiva", "annullata_senza_compenso"];
  if (!allowed.includes(status)) return;
  const res = await db
    .from("lessons")
    .update({ status, ...(status === "programmata" || status === "svolta" ? { cancelled_at: null, cancelled_by: null, cancellation_reason: null } : {}) })
    .eq("id", str(fd, "id"));
  if (res.error) throw new Error(res.error.message);
  await audit(db, staff.userId, "stato_lezione", "lessons", str(fd, "id"), { status });
  refresh(fd);
}

export async function moveLesson(fd: FormData) {
  const { db, staff } = await lessonCtx();
  const startMin = parseHhmm(str(fd, "time"));
  await applyAction(db, { type: "sposta_lezione", lessonId: str(fd, "id"), date: str(fd, "date") || null, startMin, note: "" }, staff.userId);
  const tutor = str(fd, "tutor_id");
  if (tutor) await db.from("lessons").update({ tutor_id: tutor }).eq("id", str(fd, "id"));
  refresh(fd);
}

export async function toggleLock(fd: FormData) {
  const { db } = await lessonCtx();
  await db.from("lessons").update({ locked: str(fd, "locked") === "1" }).eq("id", str(fd, "id"));
  refresh(fd);
}

/** Segna come svolte tutte le lezioni programmate già passate fino a ieri. */
export async function markPastDone() {
  const { db, staff } = await lessonCtx();
  const { data } = await db.from("lessons").update({ status: "svolta" }).eq("status", "programmata").lt("date", todayRome()).select("id");
  await audit(db, staff.userId, "segna_svolte", "lessons", null, { count: data?.length ?? 0 });
  revalidatePath("/calendario");
  revalidatePath("/conti");
}
