import { Check, MessageCircle, X } from "lucide-react";
import Link from "next/link";

import { decidePendingAction } from "@/app/(app)/actions/approvals";
import { hhmm } from "@/lib/domain/time";

import { Badge, Button, Input, Textarea } from "./ui";

export interface PendingActionRow {
  id: string;
  kind: string;
  summary: string;
  reason: string;
  payload: Record<string, unknown>;
  created_at: string;
  chat_id: string | null;
  chats: { display_name: string; phone: string } | null;
}

const KIND: Record<string, { label: string; tone: "pesca" | "pervinca" | "warn" | "danger" | "neutral"; info?: boolean; approveMsg?: string }> = {
  richiesta_lezioni: { label: "Nuove lezioni", tone: "pervinca", approveMsg: "Ciao! Abbiamo registrato la richiesta, ti mandiamo giorno e orario appena pianificato." },
  modifica_lezioni: { label: "Modifica lezioni", tone: "pervinca", approveMsg: "Modifica registrata, ti mandiamo il nuovo calendario a breve." },
  sposta_lezione: { label: "Spostamento", tone: "pervinca", approveMsg: "Fatto, la lezione è stata spostata." },
  annulla_lezione: { label: "Annullamento", tone: "warn", approveMsg: "Lezione annullata, grazie per l'avviso." },
  aggiungi_vincolo: { label: "Nuovo impegno", tone: "neutral", approveMsg: "" },
  disponibilita_tutor: { label: "Disponibilità tutor", tone: "neutral", approveMsg: "" },
  assenza_tutor: { label: "Assenza tutor", tone: "neutral", approveMsg: "" },
  annullamento_tardivo: { label: "Annullamento < 24h", tone: "danger", info: true },
  conflitto_vincolo: { label: "Conflitto con impegno", tone: "warn", info: true },
  conflitto_disponibilita: { label: "Lezioni fuori disponibilità", tone: "warn", info: true },
  lezioni_da_ricollocare: { label: "Lezioni da ricollocare", tone: "warn", info: true },
};


export function PendingAction({ a }: { a: PendingActionRow }) {
  const meta = KIND[a.kind] ?? { label: a.kind, tone: "neutral" as const, info: true };
  const when = new Date(a.created_at);
  const isMove = a.kind === "sposta_lezione";
  const isLateCancel = a.kind === "annullamento_tardivo";
  const startMin = typeof a.payload.startMin === "number" ? a.payload.startMin : null;
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        {a.chats && a.chat_id && (
          <Link href={`/chat/${a.chat_id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-pervinca-strong hover:underline">
            <MessageCircle className="size-3.5" /> {a.chats.display_name || a.chats.phone}
          </Link>
        )}
        <span className="ml-auto text-xs text-muted">
          {when.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", timeZone: "Europe/Rome" })}{" "}
          {when.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}
        </span>
      </div>
      <p className="text-sm font-medium">{a.summary}</p>
      {a.reason && <p className="text-xs text-ink-soft">{a.reason}</p>}
      <form action={decidePendingAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={a.id} />
        {isMove && (
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
            <Input type="date" name="date" defaultValue={typeof a.payload.date === "string" ? a.payload.date : ""} aria-label="Nuova data" />
            <Input name="time" placeholder="HH:MM" defaultValue={startMin !== null ? hhmm(startMin) : ""} aria-label="Nuovo orario" />
          </div>
        )}
        {a.chat_id && (
          <label className="flex flex-col gap-1.5">
            <span className="label-caps text-muted">Messaggio WhatsApp da inviare (facoltativo)</span>
            <Textarea name="notify" rows={2} className="min-h-0 text-sm" defaultValue={meta.info ? "" : (meta.approveMsg ?? "")} placeholder="Lascia vuoto per non inviare nulla" />
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          {meta.info ? (
            <>
              <Button name="decision" value="fatto" size="sm" variant="primary">
                <Check /> Gestito
              </Button>
              {isLateCancel && (
                <Button name="decision" value="senza_compenso" size="sm" variant="accent">
                  Annullata senza compenso
                </Button>
              )}
            </>
          ) : (
            <>
              <Button name="decision" value="approva" size="sm" variant="primary">
                <Check /> Approva
              </Button>
              <Button name="decision" value="rifiuta" size="sm" variant="outline">
                <X /> Rifiuta
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
