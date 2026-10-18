import { ArrowLeft, Bot, Hand, Send, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  discardDraft,
  linkChat,
  markRead,
  resolveChat,
  sendDraft,
  sendManual,
  setChatMode,
  takeOver,
} from "@/app/(app)/actions/chat";
import { LiveRefresh } from "@/components/live-refresh";
import { Badge, Button, cn, Select, Textarea } from "@/components/ui";
import type { ChatState } from "@/lib/agent/types";
import { roleOf } from "@/lib/chat/role";
import { sessionClient } from "@/lib/db/clients";
import { hhmm, longDate, romeParts } from "@/lib/domain/time";

const AUTHOR: Record<string, string> = { ai: "Assistente", coordinatore: "Coordinatore", telefono: "Dal telefono", sistema: "Sistema" };

const INTENT: Record<string, string> = {
  nuovo_vincolo: "nuovo impegno",
  rimuovi_vincolo: "impegno rimosso",
  disponibilita_tutor: "disponibilità",
  assenza_tutor: "assenza",
  richiesta_lezioni: "nuove lezioni",
  modifica_lezioni: "modifica lezioni",
  sposta_lezione: "spostamento",
  annulla_lezione: "annullamento",
  info_lezioni: "info lezioni",
  info_pagamenti: "info pagamenti",
  parla_con_coordinatore: "chiede il coordinatore",
};

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await sessionClient();
  const { data: chat } = await db.from("chats").select("*").eq("id", id).maybeSingle();
  if (!chat) notFound();

  const [{ data: msgs }, { data: events }, people] = await Promise.all([
    db.from("messages").select("*").eq("chat_id", id).order("created_at", { ascending: false }).limit(200),
    db.from("ai_events").select("message_id, intent, confidence, tier").eq("chat_id", id).order("created_at", { ascending: false }).limit(200),
    chat.parent_id || chat.student_id || chat.tutor_id
      ? Promise.resolve(null)
      : Promise.all([
          db.from("parents").select("id, first_name, last_name, families(name)").order("last_name"),
          db.from("students").select("id, first_name, last_name").order("last_name"),
          db.from("tutors").select("id, first_name, last_name").order("last_name"),
        ]),
  ]);
  const messages = (msgs ?? []).reverse();
  const interpretation = new Map<string, { intent: string | null; confidence: number | null; tier: number }>();
  for (const e of events ?? []) if (e.message_id && !interpretation.has(e.message_id)) interpretation.set(e.message_id, e);

  const now = Date.now();
  const takenUntil = chat.takeover_until && new Date(chat.takeover_until).getTime() > now ? new Date(chat.takeover_until) : null;
  const state = (chat.state ?? {}) as ChatState;
  const personHref = chat.parent_id
    ? `/persone?genitore=${chat.parent_id}`
    : chat.student_id
      ? `/persone?studente=${chat.student_id}`
      : chat.tutor_id
        ? `/persone/tutor/${chat.tutor_id}`
        : null;

  let lastDate = "";
  return (
    <div className="flex h-full w-full flex-col">
      <LiveRefresh tables={["messages", "chats"]} filter={`chat_id=eq.${id}`} onMount={markRead.bind(null, id)} />

      <header className="flex flex-wrap items-center gap-3 border-b bg-surface px-4 py-3">
        <Link href="/chat" className="rounded-full p-1.5 hover:bg-ink/5 lg:hidden" aria-label="Indietro">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg leading-tight">{chat.display_name || chat.phone}</p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{chat.phone.startsWith("lid:") ? "numero nascosto" : chat.phone}</span>
            <Badge tone={roleOf(chat) === "Sconosciuto" ? "warn" : "neutral"}>{roleOf(chat)}</Badge>
            {personHref && (
              <Link href={personHref} className="inline-flex items-center gap-1 font-semibold text-pervinca-strong hover:underline">
                <UserRound className="size-3" /> scheda
              </Link>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={setChatMode}>
            <input type="hidden" name="chatId" value={id} />
            <input type="hidden" name="mode" value={chat.mode === "ai" ? "manuale" : "ai"} />
            <Button size="sm" variant={chat.mode === "ai" ? "outline" : "accent"} title="Una chat manuale non riceve mai risposte dall'assistente">
              {chat.mode === "ai" ? <Bot /> : <Hand />}
              {chat.mode === "ai" ? "Gestita da AI" : "Manuale"}
            </Button>
          </form>
          {chat.mode === "ai" && (
            <form action={takeOver}>
              <input type="hidden" name="chatId" value={id} />
              <input type="hidden" name="hours" value={takenUntil ? 0 : 8} />
              <Button size="sm" variant={takenUntil ? "primary" : "outline"}>
                {takenUntil ? `Rilascia (tua fino alle ${hhmm(romeParts(takenUntil).minutes)})` : "Prendi il controllo"}
              </Button>
            </form>
          )}
          {chat.needs_attention && (
            <form action={resolveChat}>
              <input type="hidden" name="chatId" value={id} />
              <Button size="sm" variant="ghost">Segna come gestita</Button>
            </form>
          )}
        </div>
      </header>

      {people && (
        <form action={linkChat} className="flex flex-wrap items-center gap-2 border-b bg-pesca/10 px-4 py-2.5 text-sm">
          <input type="hidden" name="chatId" value={id} />
          <span className="font-medium">Numero non registrato: chi è?</span>
          <Select name="person" required className="w-auto min-w-56 py-1.5">
            <option value="">Scegli…</option>
            <optgroup label="Genitori">
              {(people[0].data ?? []).map((p) => (
                <option key={p.id} value={`parent:${p.id}`}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Studenti">
              {(people[1].data ?? []).map((p) => (
                <option key={p.id} value={`student:${p.id}`}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Tutor">
              {(people[2].data ?? []).map((p) => (
                <option key={p.id} value={`tutor:${p.id}`}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </optgroup>
          </Select>
          <Button size="sm" variant="primary">Collega</Button>
          <Link href="/persone" className="text-xs font-semibold text-pervinca-strong">oppure crea una nuova scheda</Link>
        </form>
      )}

      {state.pending && (
        <div className="border-b bg-pervinca/10 px-4 py-2 text-xs">
          <strong>In attesa di conferma dall&apos;utente:</strong> {state.pending.summary}
          {state.pending.needsCoordinator && " · poi passerà a te per l'approvazione"}
        </div>
      )}

      <div className="chat-wallpaper thin-scroll flex flex-1 flex-col-reverse overflow-y-auto">
        <div className="flex flex-col gap-1.5 px-3 py-4 sm:px-6">
          {messages.map((m) => {
            const p = romeParts(new Date(m.created_at));
            const sep = p.date !== lastDate ? p.date : null;
            lastDate = p.date;
            const out = m.direction === "out";
            const info = interpretation.get(m.id);
            const draft = m.status === "bozza";
            return (
              <div key={m.id} className="flex flex-col">
                {sep && (
                  <span className="mx-auto my-3 rounded-full bg-surface/90 px-3 py-1 text-[11px] font-semibold text-ink-soft shadow-sm">{longDate(sep)}</span>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%]",
                    out ? "self-end rounded-br-md" : "self-start rounded-bl-md bg-surface",
                    out && m.author === "ai" && "bg-pervinca/20 dark:bg-pervinca/25",
                    out && m.author !== "ai" && "bg-pesca/20 dark:bg-pesca/25",
                    draft && "border-2 border-dashed border-pervinca bg-surface",
                  )}
                >
                  {out && <p className="label-caps mb-0.5 text-[9px] text-ink-soft">{draft ? "Bozza dell'assistente" : AUTHOR[m.author] ?? m.author}</p>}
                  {m.media_type?.startsWith("audio") && <p className="text-xs italic text-muted">🎤 Messaggio vocale{m.transcript ? ":" : ""}</p>}
                  {draft ? (
                    <form className="flex flex-col gap-2">
                      <input type="hidden" name="messageId" value={m.id} />
                      <Textarea name="text" defaultValue={m.body} className="min-w-64 text-sm" />
                      <div className="flex gap-2">
                        <Button formAction={sendDraft} size="sm" variant="primary">
                          <Send /> Invia
                        </Button>
                        <Button formAction={discardDraft} size="sm" variant="ghost">Scarta</Button>
                      </div>
                    </form>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.transcript ?? m.body}</p>
                  )}
                  <p className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px] text-muted">
                    {info?.intent && !out && (
                      <span className="mr-auto rounded-full bg-pervinca/10 px-1.5 text-pervinca-strong" title={`livello ${info.tier}, confidenza ${Math.round((info.confidence ?? 0) * 100)}%`}>
                        {INTENT[info.intent] ?? info.intent}
                      </span>
                    )}
                    {hhmm(p.minutes)}
                    {out && !draft && <span>{m.status === "letto" ? "✓✓" : m.status === "consegnato" ? "✓✓" : m.status === "errore" ? "⚠︎" : "✓"}</span>}
                  </p>
                  {m.status === "errore" && m.error && <p className="mt-1 text-[11px] text-danger">{m.error}</p>}
                </div>
              </div>
            );
          })}
          {!messages.length && <p className="py-10 text-center text-sm text-muted">Nessun messaggio.</p>}
        </div>
      </div>

      <form action={sendManual} className="flex items-end gap-2 border-t bg-surface px-3 py-3">
        <input type="hidden" name="chatId" value={id} />
        <Textarea
          name="text"
          required
          rows={1}
          placeholder={chat.mode === "ai" && !takenUntil ? "Scrivi: l'assistente si mette in pausa per 2 ore" : "Scrivi un messaggio"}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-3xl"
        />
        <Button variant="primary" className="size-11 p-0" aria-label="Invia">
          <Send />
        </Button>
      </form>
    </div>
  );
}
