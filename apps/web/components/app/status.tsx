import { Badge } from "@/components/ui/badge";
import type { PaymentState } from "@/lib/domain/billing";
import { STATUS_LABEL, type LessonStatus } from "@/lib/domain/cancellation";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "pesca" | "pervinca";

function Status({ label, variant, dot, className }: { label: string; variant: Variant; dot?: boolean; className?: string }) {
  return (
    <Badge variant={variant} className={className}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {label}
    </Badge>
  );
}

const LESSON: Record<LessonStatus, Variant> = {
  programmata: "pervinca",
  svolta: "success",
  annullata_in_tempo: "secondary",
  annullata_tardiva: "pesca",
  annullata_senza_compenso: "secondary",
};

export function LessonStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = status as LessonStatus;
  return <Status label={STATUS_LABEL[s] ?? status} variant={LESSON[s] ?? "outline"} dot className={className} />;
}

const PAYMENT: Record<PaymentState, { label: string; variant: Variant }> = {
  saldato: { label: "Saldato", variant: "success" },
  parziale: { label: "Parziale", variant: "warning" },
  da_pagare: { label: "Da pagare", variant: "pesca" },
  in_credito: { label: "In credito", variant: "pervinca" },
  nulla: { label: "Niente da pagare", variant: "secondary" },
};

export function PaymentStateBadge({ state, className }: { state: PaymentState; className?: string }) {
  const p = PAYMENT[state];
  return <Status label={p.label} variant={p.variant} className={className} />;
}

const REQUEST: Record<string, { label: string; variant: Variant }> = {
  attiva: { label: "Attiva", variant: "success" },
  da_approvare: { label: "Da approvare", variant: "warning" },
  sospesa: { label: "Sospesa", variant: "secondary" },
  chiusa: { label: "Chiusa", variant: "outline" },
};

export function RequestStatusBadge({ status, className }: { status: string; className?: string }) {
  const r = REQUEST[status] ?? { label: status, variant: "outline" as const };
  return <Status label={r.label} variant={r.variant} dot className={className} />;
}

const PLAN: Record<string, { label: string; variant: Variant }> = {
  bozza: { label: "Bozza", variant: "warning" },
  confermato: { label: "Confermato", variant: "success" },
  scartato: { label: "Scartato", variant: "secondary" },
  errore: { label: "Errore", variant: "destructive" },
};

export function PlanStatusBadge({ status, className }: { status: string; className?: string }) {
  const r = PLAN[status] ?? { label: status, variant: "outline" as const };
  return <Status label={r.label} variant={r.variant} dot className={className} />;
}

const PENDING: Record<string, { label: string; variant: Variant }> = {
  in_attesa: { label: "Da decidere", variant: "warning" },
  approvata: { label: "Approvata", variant: "success" },
  applicata: { label: "Applicata", variant: "success" },
  rifiutata: { label: "Rifiutata", variant: "secondary" },
  errore: { label: "Errore", variant: "destructive" },
};

export function PendingActionStatusBadge({ status, className }: { status: string; className?: string }) {
  const r = PENDING[status] ?? { label: status, variant: "outline" as const };
  return <Status label={r.label} variant={r.variant} className={className} />;
}

/** Priorità dei vincoli: P1 inviolabile … P4 preferenza leggera. */
export function PriorityBadge({ priority, className }: { priority: number; className?: string }) {
  const variant: Variant = priority === 1 ? "destructive" : priority === 2 ? "pesca" : priority === 3 ? "warning" : "secondary";
  return (
    <Badge variant={variant} className={cn("tabular-nums", className)} title={PRIORITY_HELP[priority]}>
      P{priority}
    </Badge>
  );
}

export const PRIORITY_HELP: Record<number, string> = {
  1: "P1: inviolabile",
  2: "P2: molto importante",
  3: "P3: importante",
  4: "P4: preferenza",
};

export function ChatModeBadge({ mode, takeoverUntil, className }: { mode: string; takeoverUntil?: string | null; className?: string }) {
  if (mode === "manuale") return <Status label="Manuale" variant="secondary" className={className} />;
  if (takeoverUntil && new Date(takeoverUntil) > new Date()) return <Status label="In pausa" variant="warning" className={className} />;
  return <Status label="AI attiva" variant="pervinca" className={className} />;
}

export function RoleBadge({ role, className }: { role: "Genitore" | "Studente" | "Tutor" | string; className?: string }) {
  const variant: Variant = role === "Tutor" ? "pesca" : role === "Genitore" || role === "Studente" ? "pervinca" : "outline";
  return <Status label={role === "Sconosciuto" ? "Non collegato" : role} variant={variant} className={className} />;
}
