/** Implementazione in memoria di AgentRepo, per test e simulazioni. */

import type {
  Action,
  AgentRepo,
  AiEventInput,
  Chat,
  ConstraintInfo,
  LessonInfo,
  Message,
  Parent,
  PendingActionInput,
  Settings,
  Speaker,
  Student,
  Subject,
  Tutor,
} from "./types";

let seq = 0;
const id = (p: string) => `${p}${++seq}`;

export class MemoryRepo implements AgentRepo {
  chats = new Map<string, Chat>();
  messages: (Message & { status: string; provider: string })[] = [];
  parents: Parent[] = [];
  students: Student[] = [];
  tutors: Tutor[] = [];
  subjectList: Subject[] = [];
  lessonList: LessonInfo[] = [];
  constraintList: ConstraintInfo[] = [];
  aiEvents: AiEventInput[] = [];
  pendingActions: PendingActionInput[] = [];
  applied: Action[] = [];
  phones = new Map<string, { parentId?: string; studentId?: string; tutorId?: string }>();
  settingsValue: Settings = { whatsappProvider: "baileys", cancellationHours: 24, aiMonthlyBudgetEur: 14, aiEnabled: true };
  spentMicroUsd = 0;

  async getChat(chatId: string) {
    return this.chats.get(chatId) ?? null;
  }
  async updateChat(chatId: string, patch: Partial<Chat>) {
    const c = this.chats.get(chatId);
    if (c) this.chats.set(chatId, { ...c, ...patch });
  }
  async getMessage(messageId: string) {
    return this.messages.find((m) => m.id === messageId) ?? null;
  }
  async recentMessages(chatId: string, limit: number) {
    return this.messages.filter((m) => m.chat_id === chatId).slice(-limit);
  }
  async insertMessage(m: Parameters<AgentRepo["insertMessage"]>[0]) {
    const mid = id("m");
    this.messages.push({
      id: mid,
      chat_id: m.chatId,
      direction: m.direction,
      author: m.author,
      body: m.body,
      media_type: null,
      transcript: null,
      created_at: new Date().toISOString(),
      status: m.status,
      provider: m.provider,
    });
    return mid;
  }
  async updateMessage(messageId: string, patch: { status?: string }) {
    const m = this.messages.find((x) => x.id === messageId);
    if (m && patch.status) m.status = patch.status;
  }
  async speaker(chat: Chat): Promise<Speaker> {
    if (chat.parent_id) {
      const parent = this.parents.find((p) => p.id === chat.parent_id)!;
      return { kind: "genitore", parent, students: this.students.filter((s) => s.family_id === parent.family_id) };
    }
    if (chat.student_id) return { kind: "studente", student: this.students.find((s) => s.id === chat.student_id)! };
    if (chat.tutor_id) return { kind: "tutor", tutor: this.tutors.find((t) => t.id === chat.tutor_id)! };
    return { kind: "sconosciuto" };
  }
  async lessons(f: { studentIds?: string[]; tutorId?: string; from: string; to: string }) {
    return this.lessonList.filter(
      (l) =>
        l.date >= f.from &&
        l.date <= f.to &&
        (!f.tutorId || l.tutor_id === f.tutorId) &&
        (!f.studentIds || l.student_ids.some((s) => f.studentIds!.includes(s))),
    );
  }
  async constraints(studentIds: string[]) {
    return this.constraintList.filter((c) => studentIds.includes(c.student_id));
  }
  async subjects() {
    return this.subjectList;
  }
  async settings() {
    return this.settingsValue;
  }
  async monthAiCostMicroUsd() {
    return this.spentMicroUsd + this.aiEvents.reduce((a, e) => a + e.costMicroUsd, 0);
  }
  async insertAiEvent(e: AiEventInput) {
    this.aiEvents.push(e);
  }
  async insertPendingAction(p: PendingActionInput) {
    this.pendingActions.push(p);
    return id("pa");
  }
  async apply(action: Action) {
    this.applied.push(action);
  }

  addChat(partial: Partial<Chat> & { phone: string }): Chat {
    const chat: Chat = {
      id: id("c"),
      display_name: "",
      parent_id: null,
      student_id: null,
      tutor_id: null,
      mode: "ai",
      takeover_until: null,
      state: {},
      last_inbound_at: null,
      needs_attention: false,
      ...partial,
    };
    this.chats.set(chat.id, chat);
    return chat;
  }

  receive(chatId: string, body: string): string {
    const mid = id("m");
    this.messages.push({
      id: mid,
      chat_id: chatId,
      direction: "in",
      author: "utente",
      body,
      media_type: null,
      transcript: null,
      created_at: new Date().toISOString(),
      status: "ricevuto",
      provider: "test",
    });
    return mid;
  }
}
