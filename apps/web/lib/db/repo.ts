import type {
  Action,
  AgentRepo,
  AiEventInput,
  Chat,
  ConstraintInfo,
  LessonInfo,
  Message,
  PendingActionInput,
  Settings,
  Speaker,
  Student,
  Subject,
} from "@/lib/agent/types";

import { applyAction } from "./actions";
import type { Json, TablesUpdate } from "./types";
import { asJson, must, type Db } from "./util";

export async function loadSettings(db: Db): Promise<Settings & Record<string, unknown>> {
  const rows = must(await db.from("settings").select("key, value"), "impostazioni") as { key: string; value: unknown }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    ...map,
    whatsappProvider: "waxum",
    cancellationHours: Number(map.cancellation_hours ?? 24),
    aiMonthlyBudgetEur: Number(map.ai_monthly_budget_eur ?? 14),
    aiEnabled: map.ai_enabled !== false,
  };
}

type LessonRow = {
  id: string;
  date: string;
  start_min: number;
  end_min: number;
  status: LessonInfo["status"];
  mode: LessonInfo["mode"];
  tutor_id: string;
  request_id: string | null;
  subjects: { name: string } | null;
  tutors: { first_name: string; last_name: string } | null;
  lesson_students: { student_id: string; students: { first_name: string } | null }[];
};

export const LESSON_SELECT =
  "id, date, start_min, end_min, status, mode, tutor_id, request_id, subjects(name), tutors(first_name, last_name), lesson_students(student_id, students(first_name))";

export function toLessonInfo(r: LessonRow): LessonInfo {
  return {
    id: r.id,
    date: r.date,
    start_min: r.start_min,
    end_min: r.end_min,
    status: r.status,
    mode: r.mode,
    subject: r.subjects?.name ?? "",
    tutor_id: r.tutor_id,
    tutor_name: r.tutors ? `${r.tutors.first_name} ${r.tutors.last_name}`.trim() : "",
    student_ids: r.lesson_students.map((s) => s.student_id),
    student_names: r.lesson_students.map((s) => s.students?.first_name ?? ""),
    request_id: r.request_id,
  };
}

export class SupabaseRepo implements AgentRepo {
  constructor(private readonly db: Db) {}

  async getChat(id: string) {
    const { data } = await this.db.from("chats").select("*").eq("id", id).maybeSingle();
    return (data as Chat | null) ?? null;
  }

  async updateChat(id: string, patch: Partial<Chat>) {
    must(await this.db.from("chats").update(patch as TablesUpdate<"chats">).eq("id", id), "aggiornamento chat");
  }

  async getMessage(id: string) {
    const { data } = await this.db.from("messages").select("*").eq("id", id).maybeSingle();
    return (data as Message | null) ?? null;
  }

  async recentMessages(chatId: string, limit: number) {
    const rows = must(
      await this.db
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .neq("status", "bozza")
        .order("created_at", { ascending: false })
        .limit(limit),
      "messaggi recenti",
    ) as Message[];
    return rows.reverse();
  }

  async insertMessage(m: Parameters<AgentRepo["insertMessage"]>[0]) {
    const row = must(
      await this.db
        .from("messages")
        .insert({
          chat_id: m.chatId,
          direction: m.direction,
          author: m.author,
          body: m.body,
          provider: m.provider,
          provider_message_id: m.providerMessageId ?? null,
          status: m.status,
        })
        .select("id")
        .single(),
      "inserimento messaggio",
    ) as { id: string };
    if (m.status !== "bozza") {
      await this.db
        .from("chats")
        .update({ last_message_at: new Date().toISOString(), last_message_preview: m.body.slice(0, 120) })
        .eq("id", m.chatId);
    }
    return row.id;
  }

  async updateMessage(id: string, patch: { status?: string; providerMessageId?: string | null; error?: string | null; transcript?: string }) {
    const row: TablesUpdate<"messages"> = {};
    if (patch.status) row.status = patch.status;
    if (patch.providerMessageId !== undefined) row.provider_message_id = patch.providerMessageId;
    if (patch.error !== undefined) row.error = patch.error;
    if (patch.transcript) row.transcript = patch.transcript;
    must(await this.db.from("messages").update(row).eq("id", id), "aggiornamento messaggio");
  }

  async speaker(chat: Chat): Promise<Speaker> {
    if (chat.parent_id) {
      const parent = must(
        await this.db.from("parents").select("id, family_id, first_name, last_name").eq("id", chat.parent_id).single(),
        "genitore",
      ) as { id: string; family_id: string; first_name: string; last_name: string };
      const students = must(
        await this.db
          .from("students")
          .select("id, family_id, first_name, last_name, school_level")
          .eq("family_id", parent.family_id)
          .eq("active", true)
          .order("first_name"),
        "figli",
      ) as Student[];
      return { kind: "genitore", parent, students };
    }
    if (chat.student_id) {
      const student = must(
        await this.db.from("students").select("id, family_id, first_name, last_name, school_level").eq("id", chat.student_id).single(),
        "studente",
      ) as { id: string; family_id: string; first_name: string; last_name: string; school_level: string };
      return { kind: "studente", student };
    }
    if (chat.tutor_id) {
      const tutor = must(
        await this.db.from("tutors").select("id, first_name, last_name").eq("id", chat.tutor_id).single(),
        "tutor",
      ) as { id: string; first_name: string; last_name: string };
      return { kind: "tutor", tutor };
    }
    return { kind: "sconosciuto" };
  }

  async lessons(f: { studentIds?: string[]; tutorId?: string; from: string; to: string }) {
    let q = this.db.from("lessons").select(LESSON_SELECT).gte("date", f.from).lte("date", f.to);
    if (f.tutorId) q = q.eq("tutor_id", f.tutorId);
    if (f.studentIds) {
      const links = must(
        await this.db.from("lesson_students").select("lesson_id").in("student_id", f.studentIds),
        "lezioni studente",
      ) as { lesson_id: string }[];
      if (!links.length) return [];
      q = q.in("id", [...new Set(links.map((l) => l.lesson_id))]);
    }
    const rows = must(await q.order("date").order("start_min"), "lezioni") as unknown as LessonRow[];
    return rows.map(toLessonInfo);
  }

  async constraints(studentIds: string[]) {
    return must(
      await this.db
        .from("student_constraints")
        .select("id, student_id, priority, category, label, weekday, date, start_min, end_min")
        .in("student_id", studentIds)
        .or(`valid_to.is.null,valid_to.gte.${new Date().toISOString().slice(0, 10)}`)
        .order("priority"),
      "vincoli",
    ) as ConstraintInfo[];
  }

  async subjects() {
    return must(await this.db.from("subjects").select("id, name").order("name"), "materie") as Subject[];
  }

  async settings() {
    return loadSettings(this.db);
  }

  async monthAiCostMicroUsd(since: string) {
    const rows = must(
      await this.db.from("ai_events").select("cost_micro_usd").gte("created_at", since),
      "costi AI",
    ) as { cost_micro_usd: number }[];
    return rows.reduce((a, r) => a + Number(r.cost_micro_usd), 0);
  }

  async insertAiEvent(e: AiEventInput) {
    await this.db.from("ai_events").insert({
      chat_id: e.chatId,
      message_id: e.messageId,
      model: e.model,
      tier: e.tier,
      input_tokens: e.inputTokens,
      output_tokens: e.outputTokens,
      cost_micro_usd: e.costMicroUsd,
      intent: e.intent,
      confidence: e.confidence,
      output: e.output as Json,
    });
  }

  async insertPendingAction(p: PendingActionInput) {
    const row = must(
      await this.db
        .from("pending_actions")
        .insert({
          chat_id: p.chatId,
          kind: p.kind,
          payload: asJson(p.payload),
          summary: p.summary,
          reason: p.reason,
          source_message_id: p.sourceMessageId,
        })
        .select("id")
        .single(),
      "azione in attesa",
    ) as { id: string };
    return row.id;
  }

  async apply(action: Action) {
    await applyAction(this.db, action, "ai");
  }
}
