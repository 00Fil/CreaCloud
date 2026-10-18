/**
 * Gestione di un messaggio in arrivo: chi scrive, modalità della chat, tetto
 * di spesa, interpretazione su due livelli, decisione, risposta.
 */

import { costMicroUsd, microUsdToEur } from "@/lib/ai/pricing";
import type { LlmPart, LlmProvider } from "@/lib/ai/llm";
import { addDays, monthStart, romeParts, romeToInstant } from "@/lib/domain/time";

import { decide, type Decision } from "./decide";
import { buildContext, SYSTEM_PROMPT } from "./prompt";
import { quickYesNo } from "./resolve";
import { interpretationJsonSchema, InterpretationSchema, type Interpretation } from "./schema";
import type { AgentRepo, Chat, ChatState, Message, OutboundChannel, Speaker } from "./types";

export interface ModelChoice {
  provider: LlmProvider;
  model: string;
}

export interface AgentDeps {
  repo: AgentRepo;
  channel: OutboundChannel;
  fast: ModelChoice;
  smart: ModelChoice;
  audio?: (message: Message) => Promise<{ mimeType: string; base64: string } | null>;
  now?: () => Date;
}

export type Outcome =
  | { status: "ignorato"; reason: string }
  | { status: "risposto" | "bozza"; reply: string; intent: string | null };

const PENDING_TTL_H = 24;
const ESCALATE_BELOW = 0.75;
const ESCALATE_INTENTS = new Set(["nuovo_vincolo", "altro", "modifica_lezioni"]);

const UNKNOWN_REPLY =
  "Ciao! Sono l'assistente di Creattivamente. Non trovo il tuo numero tra i contatti registrati: il coordinatore ti risponderà a breve.";

export async function handleInbound(deps: AgentDeps, chatId: string, messageId: string): Promise<Outcome> {
  const now = deps.now?.() ?? new Date();
  const { repo } = deps;
  const chat = await repo.getChat(chatId);
  const message = await repo.getMessage(messageId);
  if (!chat || !message) return { status: "ignorato", reason: "chat o messaggio non trovati" };
  if (chat.mode === "manuale") return attention(repo, chat, "chat manuale");
  if (chat.takeover_until && new Date(chat.takeover_until) > now) return attention(repo, chat, "presa in carico dal coordinatore");

  const settings = await repo.settings();
  if (!settings.aiEnabled) return attention(repo, chat, "AI disattivata");

  const { date: today, minutes } = romeParts(now);
  const spent = microUsdToEur(await repo.monthAiCostMicroUsd(romeToInstant(monthStart(today), 0).toISOString()));
  const draft = spent >= settings.aiMonthlyBudgetEur;

  const speaker = await repo.speaker(chat);
  if (speaker.kind === "sconosciuto") {
    if (chat.state.lastIntent === "sconosciuto") return attention(repo, chat, "numero sconosciuto");
    await repo.updateChat(chat.id, { state: { lastIntent: "sconosciuto" }, needs_attention: true });
    return send(deps, chat, UNKNOWN_REPLY, draft, null);
  }

  const text = (message.transcript ?? message.body).trim();
  const state: ChatState = { ...chat.state };
  if (state.pending && new Date(state.pending.expiresAt) < now) delete state.pending;

  // conferme sì/no: niente modello, niente costi
  if (state.pending && text) {
    const yn = quickYesNo(text);
    if (yn) return confirmPending(deps, chat, state, yn, messageId, draft);
  }

  const studentIds =
    speaker.kind === "genitore" ? speaker.students.map((s) => s.id) : speaker.kind === "studente" ? [speaker.student.id] : [];
  const [lessons, constraints, subjects, recent] = await Promise.all([
    repo.lessons({
      studentIds: studentIds.length ? studentIds : undefined,
      tutorId: speaker.kind === "tutor" ? speaker.tutor.id : undefined,
      from: today,
      to: addDays(today, 21),
    }),
    studentIds.length ? repo.constraints(studentIds) : Promise.resolve([]),
    repo.subjects(),
    repo.recentMessages(chat.id, 9),
  ]);
  const ctx = buildContext({
    speaker,
    today,
    nowMinutes: minutes,
    lessons,
    constraints,
    subjects,
    transcript: recent.filter((m) => m.id !== message.id).slice(-8),
    state,
  });

  const parts: LlmPart[] = [{ text: ctx.text }];
  const audio = message.media_type?.startsWith("audio") && deps.audio ? await deps.audio(message) : null;
  if (audio && deps.fast.provider.supportsAudio) {
    parts.push({ text: "Messaggio vocale da interpretare:" }, { audio });
  } else if (text) {
    parts.push({ text: `Messaggio da interpretare: «${text}»` });
  } else {
    return send(deps, chat, "Riesco a leggere solo messaggi di testo o vocali, mi scriveresti il messaggio?", draft, null);
  }

  let interp = await interpret(deps, deps.fast, 1, chat, message, parts);
  if (!interp || interp.confidenza < ESCALATE_BELOW || ESCALATE_INTENTS.has(interp.intento)) {
    const smarter = await interpret(deps, deps.smart, 2, chat, message, parts);
    if (smarter) interp = smarter;
  }
  if (!interp) {
    await repo.updateChat(chat.id, { needs_attention: true });
    return send(deps, chat, "Scusami, non sono riuscito a capire bene. Ho avvisato il coordinatore che ti risponderà a breve.", draft, null);
  }

  const decision = decide({
    interp,
    refs: ctx.refs,
    speaker,
    subjects,
    lessons,
    today,
    now,
    cancellationHours: settings.cancellationHours,
  });
  await applyDecision(deps, chat, decision, interp.intento, messageId, now);
  return send(deps, chat, decision.reply, draft, interp.intento);
}

async function interpret(
  deps: AgentDeps,
  choice: ModelChoice,
  tier: number,
  chat: Chat,
  message: Message,
  parts: LlmPart[],
): Promise<Interpretation | null> {
  try {
    const res = await choice.provider.generate({
      model: choice.model,
      system: SYSTEM_PROMPT,
      history: [],
      parts,
      schema: interpretationJsonSchema,
    });
    const parsed = InterpretationSchema.safeParse(res.json);
    await deps.repo.insertAiEvent({
      chatId: chat.id,
      messageId: message.id,
      model: res.model,
      tier,
      inputTokens: res.usage.inputTokens,
      outputTokens: res.usage.outputTokens,
      costMicroUsd: costMicroUsd(res.model, res.usage),
      intent: parsed.success ? parsed.data.intento : null,
      confidence: parsed.success ? parsed.data.confidenza : null,
      output: parsed.success ? parsed.data : { invalid: res.raw.slice(0, 2000) },
    });
    return parsed.success ? parsed.data : null;
  } catch (e) {
    await deps.repo.insertAiEvent({
      chatId: chat.id,
      messageId: message.id,
      model: choice.model,
      tier,
      inputTokens: 0,
      outputTokens: 0,
      costMicroUsd: 0,
      intent: null,
      confidence: null,
      output: { error: String(e).slice(0, 500) },
    });
    return null;
  }
}

async function applyDecision(
  deps: AgentDeps,
  chat: Chat,
  d: Decision,
  intent: string,
  messageId: string,
  now: Date,
): Promise<void> {
  const next: ChatState = { lastIntent: intent };
  if (d.pending) {
    next.pending = { ...d.pending, expiresAt: new Date(now.getTime() + PENDING_TTL_H * 3_600_000).toISOString() };
  }
  if (d.awaiting) next.awaiting = { intent, question: d.awaiting, at: now.toISOString() };
  if (d.queue) await deps.repo.insertPendingAction({ ...d.queue, chatId: chat.id, sourceMessageId: messageId });
  await deps.repo.updateChat(chat.id, {
    state: next,
    needs_attention: chat.needs_attention || Boolean(d.attention),
    takeover_until: d.takeover ? new Date(now.getTime() + 8 * 3_600_000).toISOString() : chat.takeover_until,
  });
}

async function confirmPending(
  deps: AgentDeps,
  chat: Chat,
  state: ChatState,
  yn: "si" | "no",
  messageId: string,
  draft: boolean,
): Promise<Outcome> {
  const pending = state.pending!;
  const { repo } = deps;
  await repo.updateChat(chat.id, { state: { lastIntent: yn === "si" ? "conferma" : "rifiuto" } });
  if (yn === "no") {
    return send(deps, chat, "Va bene, non registro nulla. Dimmi pure cosa vuoi cambiare.", draft, "rifiuto");
  }
  if (pending.needsCoordinator) {
    await repo.insertPendingAction({
      chatId: chat.id,
      kind: pending.action.type,
      payload: pending.action,
      summary: pending.summary,
      reason: pending.reason,
      sourceMessageId: messageId,
    });
    await repo.updateChat(chat.id, { needs_attention: true });
    return send(deps, chat, pending.doneMessage, draft, "conferma");
  }
  try {
    await repo.apply(pending.action);
  } catch (e) {
    await repo.insertPendingAction({
      chatId: chat.id,
      kind: pending.action.type,
      payload: pending.action,
      summary: pending.summary,
      reason: `Esecuzione automatica non riuscita: ${String(e).slice(0, 200)}`,
      sourceMessageId: messageId,
    });
    await repo.updateChat(chat.id, { needs_attention: true });
    return send(deps, chat, "Ricevuto! Lo passo al coordinatore che lo registra a breve.", draft, "conferma");
  }
  if (pending.followUp) {
    await repo.insertPendingAction({
      chatId: chat.id,
      kind: pending.followUp.kind,
      payload: pending.action,
      summary: pending.followUp.summary,
      reason: pending.followUp.reason,
      sourceMessageId: messageId,
    });
  }
  return send(deps, chat, pending.doneMessage, draft, "conferma");
}

async function attention(repo: AgentRepo, chat: Chat, reason: string): Promise<Outcome> {
  if (!chat.needs_attention) await repo.updateChat(chat.id, { needs_attention: true });
  return { status: "ignorato", reason };
}

async function send(deps: AgentDeps, chat: Chat, reply: string, draft: boolean, intent: string | null): Promise<Outcome> {
  if (draft) {
    await deps.repo.insertMessage({
      chatId: chat.id,
      direction: "out",
      author: "ai",
      body: reply,
      provider: deps.channel.provider,
      status: "bozza",
    });
    await deps.repo.updateChat(chat.id, { needs_attention: true });
    return { status: "bozza", reply, intent };
  }
  const id = await deps.repo.insertMessage({
    chatId: chat.id,
    direction: "out",
    author: "ai",
    body: reply,
    provider: deps.channel.provider,
    status: "in_invio",
  });
  try {
    const res = await deps.channel.send(chat.phone, reply, { lastInboundAt: chat.last_inbound_at });
    await deps.repo.updateMessage(id, { status: "inviato", providerMessageId: res.providerMessageId });
  } catch (e) {
    await deps.repo.updateMessage(id, { status: "errore", error: String(e).slice(0, 500) });
    await deps.repo.updateChat(chat.id, { needs_attention: true });
  }
  return { status: "risposto", reply, intent };
}

export type { Speaker };
