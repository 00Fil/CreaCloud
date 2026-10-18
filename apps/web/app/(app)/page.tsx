import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { PendingAction, type PendingActionRow } from "@/components/pending-action";
import { Badge, Card, CardHeader, Empty, LinkButton, PageHeader, Stat } from "@/components/ui";
import { microUsdToEur } from "@/lib/ai/pricing";
import { sessionClient } from "@/lib/db/clients";
import { LESSON_SELECT, loadSettings, toLessonInfo } from "@/lib/db/repo";
import { hhmm, longDate, monthStart, romeToInstant, todayRome } from "@/lib/domain/time";
import type { EngineSolution } from "@/lib/planning/engine-types";

export default async function TodayPage() {
  const db = await sessionClient();
  const today = todayRome();
  const [actions, lessons, attention, aiRows, settings, lastRun] = await Promise.all([
    db
      .from("pending_actions")
      .select("id, kind, summary, reason, payload, created_at, chat_id, chats(display_name, phone)")
      .eq("status", "in_attesa")
      .order("created_at"),
    db.from("lessons").select(LESSON_SELECT).eq("date", today).order("start_min"),
    db
      .from("chats")
      .select("id, display_name, phone, last_message_preview")
      .eq("needs_attention", true)
      .order("last_message_at", { ascending: false })
      .limit(6),
    db.from("ai_events").select("cost_micro_usd").gte("created_at", romeToInstant(monthStart(today), 0).toISOString()),
    loadSettings(db),
    db
      .from("planning_runs")
      .select("id, month, status, solution")
      .in("status", ["bozza", "confermato"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const pending = (actions.data ?? []) as unknown as PendingActionRow[];
  const todays = ((lessons.data ?? []) as unknown as Parameters<typeof toLessonInfo>[0][]).map(toLessonInfo);
  const spent = microUsdToEur((aiRows.data ?? []).reduce((a, r) => a + Number(r.cost_micro_usd), 0));
  const unplaced = (lastRun.data?.solution as EngineSolution | null)?.unplaced.length ?? 0;
  const active = todays.filter((l) => !l.status.startsWith("annullata"));

  return (
    <>
      <PageHeader eyebrow={longDate(today)} title="Buongiorno" />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Da approvare" value={pending.length} tone={pending.length ? "pesca" : undefined} hint="richieste dall'assistente" />
        <Stat label="Chat da seguire" value={attention.data?.length ?? 0} hint="manuali o segnalate" />
        <Stat label="Lezioni oggi" value={active.length} hint={`${todays.length - active.length} annullate`} />
        <Stat
          label="Spesa AI del mese"
          value={`${spent.toFixed(2).replace(".", ",")} €`}
          hint={`tetto ${settings.aiMonthlyBudgetEur} €${spent >= settings.aiMonthlyBudgetEur ? " · solo bozze" : ""}`}
          tone={spent >= settings.aiMonthlyBudgetEur ? "warn" : "pervinca"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Da approvare" subtitle="Azioni che l'assistente non può decidere da solo" />
          {pending.length ? <div className="divide-y">{pending.map((a) => <PendingAction key={a.id} a={a} />)}</div> : <Empty>Nessuna richiesta in attesa. 🎉</Empty>}
        </Card>

        <div className="flex flex-col gap-6">
          {unplaced > 0 && lastRun.data && (
            <Card className="border-pesca/30 p-5">
              <p className="label-caps text-pesca">Pianificazione</p>
              <p className="mt-2 text-sm">
                Nell&apos;ultimo piano ci sono <strong>{unplaced}</strong> lezioni non collocabili.
              </p>
              <LinkButton href={`/piano?run=${lastRun.data.id}`} variant="outline" size="sm" className="mt-3">
                Vedi motivi <ArrowRight />
              </LinkButton>
            </Card>
          )}

          <Card>
            <CardHeader title="Lezioni di oggi" action={<Link href="/calendario" className="text-xs font-semibold text-pervinca-strong">Calendario</Link>} />
            {todays.length ? (
              <ul className="divide-y">
                {todays.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="w-24 shrink-0 font-semibold tabular-nums">
                      {hhmm(l.start_min)}–{hhmm(l.end_min)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {l.subject} · {l.student_names.join(", ")} <span className="text-muted">con {l.tutor_name}</span>
                    </span>
                    {l.status.startsWith("annullata") ? <Badge tone="danger">annullata</Badge> : l.mode === "online" ? <Badge tone="pervinca">online</Badge> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nessuna lezione oggi.</Empty>
            )}
          </Card>

          <Card>
            <CardHeader title="Chat da seguire" action={<Link href="/chat" className="text-xs font-semibold text-pervinca-strong">Tutte</Link>} />
            {attention.data?.length ? (
              <ul className="divide-y">
                {attention.data.map((c) => (
                  <li key={c.id}>
                    <Link href={`/chat/${c.id}`} className="block px-5 py-3 hover:bg-ink/[0.03]">
                      <p className="text-sm font-semibold">{c.display_name || c.phone}</p>
                      <p className="truncate text-xs text-muted">{c.last_message_preview}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Tutto tranquillo.</Empty>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
