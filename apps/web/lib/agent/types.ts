import type { LessonStatus } from "@/lib/domain/cancellation";
import type { DateStr } from "@/lib/domain/time";

export type ChatMode = "ai" | "manuale";
export type MessageAuthor = "utente" | "ai" | "coordinatore" | "telefono" | "sistema";

export interface Chat {
  id: string;
  phone: string;
  display_name: string;
  parent_id: string | null;
  student_id: string | null;
  tutor_id: string | null;
  mode: ChatMode;
  takeover_until: string | null;
  state: ChatState;
  last_inbound_at: string | null;
  needs_attention: boolean;
}

export interface Message {
  id: string;
  chat_id: string;
  direction: "in" | "out";
  author: MessageAuthor;
  body: string;
  media_type: string | null;
  media_ref?: string | null;
  transcript: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  family_id: string;
  first_name: string;
  last_name: string;
  school_level: string;
}

export interface Parent {
  id: string;
  family_id: string;
  first_name: string;
  last_name: string;
}

export interface Tutor {
  id: string;
  first_name: string;
  last_name: string;
}

export interface Subject {
  id: string;
  name: string;
}

export interface LessonInfo {
  id: string;
  date: DateStr;
  start_min: number;
  end_min: number;
  status: LessonStatus;
  mode: "presenza" | "online";
  subject: string;
  tutor_id: string;
  tutor_name: string;
  student_ids: string[];
  student_names: string[];
  request_id: string | null;
}

export interface ConstraintInfo {
  id: string;
  student_id: string;
  priority: number;
  category: string;
  label: string;
  weekday: number | null;
  date: DateStr | null;
  start_min: number;
  end_min: number;
}

export type Speaker =
  | { kind: "genitore"; parent: Parent; students: Student[] }
  | { kind: "studente"; student: Student }
  | { kind: "tutor"; tutor: Tutor }
  | { kind: "sconosciuto" };

/** Azione concreta sul sistema, già validata. Usata sia dall'agente sia dalle approvazioni. */
export type Action =
  | {
      type: "aggiungi_vincolo";
      studentId: string;
      priority: number;
      category: string;
      label: string;
      weekdays: number[];
      date: DateStr | null;
      startMin: number;
      endMin: number;
      validTo: DateStr | null;
    }
  | { type: "rimuovi_vincolo"; constraintId: string }
  | {
      type: "disponibilita_tutor";
      tutorId: string;
      windows: { weekday: number; startMin: number; endMin: number }[];
      replaceAll: boolean;
    }
  | { type: "assenza_tutor"; tutorId: string; from: DateStr; to: DateStr; startMin: number; endMin: number; note: string }
  | {
      type: "richiesta_lezioni";
      studentId: string;
      subjectId: string;
      sessionsPerWeek: number;
      durationMin: number;
      mode: "presenza" | "online" | "indifferente";
      topic: string | null;
      single: boolean;
      windowFrom: DateStr | null;
      windowTo: DateStr | null;
    }
  | { type: "annulla_lezione"; lessonId: string; status: LessonStatus; reason: string; by: string }
  | { type: "sposta_lezione"; lessonId: string; date: DateStr | null; startMin: number | null; note: string }
  | {
      type: "modifica_lezioni";
      requestId: string | null;
      studentId: string;
      sessionsPerWeek: number | null;
      durationMin: number | null;
      note: string;
    };

export interface PendingConfirmation {
  action: Action;
  summary: string;
  /** se true, dopo il "sì" dell'utente l'azione va in approvazione al coordinatore */
  needsCoordinator: boolean;
  reason: string;
  /** messaggio da inviare dopo il "sì" */
  doneMessage: string;
  /** segnalazione al coordinatore dopo l'esecuzione (es. lezioni in conflitto) */
  followUp?: { kind: string; summary: string; reason: string };
  expiresAt: string;
}

export interface ChatState {
  pending?: PendingConfirmation;
  /** domanda di chiarimento in sospeso: il prossimo messaggio la completa */
  awaiting?: { intent: string; question: string; at: string };
  lastIntent?: string;
}

export interface Settings {
  whatsappProvider: "waxum";
  cancellationHours: number;
  aiMonthlyBudgetEur: number;
  aiEnabled: boolean;
}

export interface AiEventInput {
  chatId: string;
  messageId: string;
  model: string;
  tier: number;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  intent: string | null;
  confidence: number | null;
  output: unknown;
}

export interface PendingActionInput {
  chatId: string | null;
  kind: string;
  payload: unknown;
  summary: string;
  reason: string;
  sourceMessageId: string | null;
}

/** Accesso ai dati usato dall'agente; implementato su Supabase e in memoria per i test. */
export interface AgentRepo {
  getChat(id: string): Promise<Chat | null>;
  updateChat(id: string, patch: Partial<Omit<Chat, "id">>): Promise<void>;
  getMessage(id: string): Promise<Message | null>;
  recentMessages(chatId: string, limit: number): Promise<Message[]>;
  insertMessage(m: {
    chatId: string;
    direction: "in" | "out";
    author: MessageAuthor;
    body: string;
    provider: string;
    providerMessageId?: string | null;
    status: string;
  }): Promise<string>;
  updateMessage(
    id: string,
    patch: { status?: string; providerMessageId?: string | null; error?: string | null; transcript?: string },
  ): Promise<void>;
  speaker(chat: Chat): Promise<Speaker>;
  lessons(filter: { studentIds?: string[]; tutorId?: string; from: DateStr; to: DateStr }): Promise<LessonInfo[]>;
  constraints(studentIds: string[]): Promise<ConstraintInfo[]>;
  subjects(): Promise<Subject[]>;
  settings(): Promise<Settings>;
  monthAiCostMicroUsd(monthStart: string): Promise<number>;
  insertAiEvent(e: AiEventInput): Promise<void>;
  insertPendingAction(p: PendingActionInput): Promise<string>;
  apply(action: Action): Promise<void>;
}

export interface OutboundChannel {
  readonly provider: string;
  send(
    phone: string,
    text: string,
    opts?: { lastInboundAt?: string | null; manual?: boolean },
  ): Promise<{ providerMessageId: string | null }>;
}
