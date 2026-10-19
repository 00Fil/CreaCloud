import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  GraduationCap,
  Inbox,
  MessageCircle,
  UserPlus,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { QuickStart } from "@/components/quick-start";
import {
  PendingAction,
  type PendingActionRow,
} from "@/components/pending-action";
import { Tabs } from "@/components/kit/tabs";
import {
  Badge,
  Card,
  CardHeader,
  cn,
  Empty,
  LinkButton,
  PriorityBadge,
  Stat,
} from "@/components/ui";
import { microUsdToEur } from "@/lib/ai/pricing";
import { sessionClient } from "@/lib/db/clients";
import { LESSON_SELECT, loadSettings, toLessonInfo } from "@/lib/db/repo";
import {
  hhmm,
  longDate,
  monthStart,
  romeParts,
  romeToInstant,
  shortDate,
  todayRome,
  WEEKDAYS,
} from "@/lib/domain/time";
import type { EngineSolution } from "@/lib/planning/engine-types";

export default async function TodayPage() {
  const db = await sessionClient();
  const today = todayRome();
  const [
    actions,
    lessons,
    attention,
    aiRows,
    settings,
    lastRun,
    toConfirm,
    familyCount,
  ] = await Promise.all([
    db
      .from("pending_actions")
      .select(
        "id, kind, summary, reason, payload, created_at, chat_id, chats(display_name, phone)",
      )
      .eq("status", "in_attesa")
      .order("created_at"),
    db
      .from("lessons")
      .select(LESSON_SELECT)
      .eq("date", today)
      .order("start_min"),
    db
      .from("chats")
      .select("id, display_name, phone, last_message_preview")
      .eq("needs_attention", true)
      .order("last_message_at", { ascending: false })
      .limit(6),
    db
      .from("ai_events")
      .select("cost_micro_usd")
      .gte("created_at", romeToInstant(monthStart(today), 0).toISOString()),
    loadSettings(db),
    db
      .from("planning_runs")
      .select("id, month, status, solution")
      .in("status", ["bozza", "confermato"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("student_constraints")
      .select(
        "id, label, priority, weekday, date, start_min, end_min, students(first_name, last_name, family_id)",
      )
      .eq("priority_confirmed", false)
      .order("created_at", { ascending: false })
      .limit(20),
    db.from("families").select("id", { count: "exact", head: true }),
  ]);
  const pending = (actions.data ?? []) as unknown as PendingActionRow[];
  const todays = (
    (lessons.data ?? []) as unknown as Parameters<typeof toLessonInfo>[0][]
  ).map(toLessonInfo);
  const spent = microUsdToEur(
    (aiRows.data ?? []).reduce((a, r) => a + Number(r.cost_micro_usd), 0),
  );
  const unplaced =
    (lastRun.data?.solution as EngineSolution | null)?.unplaced.length ?? 0;
  const active = todays.filter((l) => !l.status.startsWith("annullata"));

  const unplacedList =
    (lastRun.data?.solution as EngineSolution | null)?.unplaced ?? [];
  const confirmList = (toConfirm.data ?? []) as unknown as {
    id: string;
    label: string;
    priority: number;
    weekday: number | null;
    date: string | null;
    start_min: number;
    end_min: number;
    students: {
      first_name: string;
      last_name: string;
      family_id: string;
    } | null;
  }[];
  const chats = attention.data ?? [];
  const todo = pending.length + chats.length + confirmList.length + unplaced;
  const now = romeParts(new Date()).minutes;
  const greeting =
    now < 13 * 60
      ? "Buongiorno"
      : now < 18 * 60
        ? "Buon pomeriggio"
        : "Buonasera";

  const QUICK = [
    {
      href: "/persone?nuova=famiglia",
      label: "Nuova famiglia",
      icon: UserPlus,
    },
    {
      href: "/persone?tab=tutor&nuova=tutor",
      label: "Nuovo tutor",
      icon: GraduationCap,
    },
    { href: "/piano", label: "Pianifica il mese", icon: CalendarRange },
    { href: "/conti", label: "Incassi e pagamenti", icon: Wallet },
  ];

  const inbox = (
    <Tabs
      param="da_fare"
      initial={
        pending.length
          ? "approvazioni"
          : chats.length
            ? "chat"
            : confirmList.length
              ? "priorita"
              : unplaced
                ? "piano"
                : undefined
      }
      items={[
        {
          id: "approvazioni",
          label: "Da approvare",
          badge: pending.length,
          content: (
            <Card>
              {pending.length ? (
                <div className="divide-y">
                  {pending.map((a) => (
                    <PendingAction key={a.id} a={a} />
                  ))}
                </div>
              ) : (
                <Empty>Nessuna richiesta dell’assistente in attesa.</Empty>
              )}
            </Card>
          ),
        },
        {
          id: "chat",
          label: "Chat",
          badge: chats.length,
          content: (
            <Card>
              {chats.length ? (
                <ul className="divide-y">
                  {chats.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/chat/${c.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-ink/[0.03]"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pesca/15 text-pesca-deep">
                          <MessageCircle
                            aria-hidden="true"
                            className="size-4"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">
                            {c.display_name || c.phone}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {c.last_message_preview}
                          </span>
                        </span>
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 text-muted"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Nessuna chat da seguire.</Empty>
              )}
            </Card>
          ),
        },
        {
          id: "priorita",
          label: "Priorità da confermare",
          badge: confirmList.length,
          content: (
            <Card>
              {confirmList.length ? (
                <ul className="divide-y">
                  {confirmList.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/persone/famiglia/${c.students?.family_id}`}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm hover:bg-ink/[0.03]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">
                            {c.students?.first_name} {c.students?.last_name} ·{" "}
                            {c.label}
                          </span>
                          <span className="text-xs text-muted">
                            {c.weekday !== null
                              ? `ogni ${WEEKDAYS[c.weekday]}`
                              : `il ${shortDate(c.date!)}`}{" "}
                            · {hhmm(c.start_min)}–{hhmm(c.end_min)} · letto da
                            WhatsApp
                          </span>
                        </span>
                        <PriorityBadge priority={c.priority} />
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 text-muted"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Tutte le priorità sono confermate.</Empty>
              )}
            </Card>
          ),
        },
        {
          id: "piano",
          label: "Non collocate",
          badge: unplaced,
          content: (
            <Card>
              {unplacedList.length && lastRun.data ? (
                <>
                  <ul className="divide-y">
                    {unplacedList.slice(0, 8).map((u, i) => (
                      <li key={i} className="flex gap-3 px-5 py-3 text-sm">
                        <AlertTriangle
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0 text-warn"
                        />
                        <span className="text-ink-soft">{u.reasons[0]}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t px-5 py-3">
                    <LinkButton
                      href={`/piano?run=${lastRun.data.id}&tab=problemi`}
                      variant="outline"
                      size="sm"
                    >
                      Apri il piano <ArrowRight />
                    </LinkButton>
                  </div>
                </>
              ) : (
                <Empty>
                  Nell’ultimo piano tutte le lezioni sono collocate.
                </Empty>
              )}
            </Card>
          ),
        },
      ]}
    />
  );

  const timeline = (
    <Card>
      <CardHeader
        title="Lezioni di oggi"
        subtitle={`${active.length} in programma${todays.length - active.length ? ` · ${todays.length - active.length} annullate` : ""}`}
        action={
          <LinkButton href="/calendario" variant="ghost" size="sm">
            Calendario
          </LinkButton>
        }
      />
      {todays.length ? (
        <ol className="relative px-5 py-4">
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-[29px] top-6 w-px bg-line"
          />
          {todays.map((l) => {
            const cancelled = l.status.startsWith("annullata");
            const live = !cancelled && l.start_min <= now && now < l.end_min;
            const done = l.end_min <= now;
            return (
              <li key={l.id} className="relative flex gap-4 py-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-surface",
                    live
                      ? "bg-pesca-strong"
                      : done || cancelled
                        ? "bg-line"
                        : "bg-pervinca",
                  )}
                />
                <Link
                  href={`/calendario?giorno=${today}&lezione=${l.id}`}
                  className={cn(
                    "min-w-0 flex-1 rounded-xl px-3 py-2 text-sm hover:bg-ink/[0.03]",
                    live && "bg-pesca/10",
                    (done || cancelled) && "opacity-60",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">
                      {hhmm(l.start_min)}–{hhmm(l.end_min)}
                    </span>
                    {live && <Badge tone="pesca">in corso</Badge>}
                    {cancelled && <Badge tone="danger">annullata</Badge>}
                    {!cancelled && l.mode === "online" && (
                      <Badge tone="pervinca">online</Badge>
                    )}
                  </span>
                  <span
                    className={cn(
                      "block truncate",
                      cancelled && "line-through",
                    )}
                  >
                    {l.student_names.join(", ")} · {l.subject}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    con {l.tutor_name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <Empty>Nessuna lezione oggi.</Empty>
      )}
    </Card>
  );

  return (
    <>
      <header className="mb-6">
        <p className="label-caps mb-1.5 text-pesca">
          {longDate(today)}
        </p>
        <h1 className="text-3xl leading-tight sm:text-4xl">{greeting}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {todo
            ? `Hai ${todo} ${todo === 1 ? "cosa" : "cose"} da sistemare e ${active.length} lezioni oggi.`
            : `Niente in sospeso. Oggi ci sono ${active.length} lezioni.`}
        </p>
      </header>

      <nav
        aria-label="Azioni rapide"
        className="thin-scroll -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {QUICK.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border bg-surface px-4 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <Icon aria-hidden="true" className="size-4 text-pervinca-strong" />
            {label}
          </Link>
        ))}
      </nav>

      {!familyCount.count && <QuickStart />}

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Da approvare"
          value={pending.length}
          tone={pending.length ? "pesca" : undefined}
          hint="richieste dall'assistente"
        />
        <Stat
          label="Chat da seguire"
          value={chats.length}
          hint="manuali o segnalate"
        />
        <Stat
          label="Lezioni oggi"
          value={active.length}
          hint={`${todays.length - active.length} annullate`}
        />
        <Stat
          label="Spesa AI del mese"
          value={`${spent.toFixed(2).replace(".", ",")} €`}
          hint={`tetto ${settings.aiMonthlyBudgetEur} €${spent >= settings.aiMonthlyBudgetEur ? " · solo bozze" : ""}`}
          tone={spent >= settings.aiMonthlyBudgetEur ? "warn" : "pervinca"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section aria-labelledby="da-fare" className="min-w-0">
          <h2 id="da-fare" className="mb-3 flex items-center gap-2 text-xl">
            <Inbox aria-hidden="true" className="size-5 text-pervinca-strong" />{" "}
            Da fare
          </h2>
          {inbox}
        </section>
        <section aria-label="Lezioni di oggi" className="min-w-0 xl:pt-10">
          {timeline}
        </section>
      </div>
    </>
  );
}
