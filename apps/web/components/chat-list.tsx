"use client";

import { Bot, Hand, Search } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { cn } from "./ui";

export interface ChatListItem {
  id: string;
  name: string;
  phone: string;
  role: string;
  manual: boolean;
  when: string;
  preview: string;
  unread: number;
  attention: boolean;
}

const FILTERS = [
  { key: "tutte", label: "Tutte" },
  { key: "seguire", label: "Da seguire" },
  { key: "manuali", label: "Manuali" },
] as const;

export function ChatList({ chats }: { chats: ChatListItem[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("tutte");
  const params = useParams<{ id?: string }>();
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return chats.filter(
      (c) =>
        (!needle || `${c.name} ${c.phone}`.toLowerCase().includes(needle)) &&
        (filter === "tutte" || (filter === "seguire" && c.attention) || (filter === "manuali" && c.manual)),
    );
  }, [chats, q, filter]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 pb-3 pt-5">
        <h1 className="mb-3 text-2xl">Chat</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca nome o numero"
            className="w-full rounded-full border bg-surface-2 py-2 pl-9 pr-3 text-sm focus:border-pervinca focus:outline-none"
          />
        </div>
        <div className="mt-3 flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold text-ink-soft",
                filter === f.key && "border-pervinca bg-pervinca/10 text-pervinca-strong",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="thin-scroll flex-1 overflow-y-auto">
        {shown.map((c) => (
          <li key={c.id}>
            <Link
              href={`/chat/${c.id}`}
              className={cn("flex gap-3 border-b px-4 py-3 hover:bg-ink/[0.03]", params.id === c.id && "bg-pervinca/8")}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pervinca/15 font-serif text-lg text-pervinca-strong">
                {c.name.replace(/^\+/, "").slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-muted">{c.when}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  {c.manual ? <Hand className="size-3.5 shrink-0 text-pesca" /> : <Bot className="size-3.5 shrink-0 text-pervinca" />}
                  <span className="shrink-0">{c.role} ·</span>
                  <span className="truncate">{c.preview}</span>
                  {c.unread > 0 && <span className="ml-auto rounded-full bg-pervinca px-1.5 text-[10px] font-bold text-white">{c.unread}</span>}
                  {c.attention && <span className={cn("size-2 shrink-0 rounded-full bg-pesca-strong", c.unread > 0 ? "" : "ml-auto")} />}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {!shown.length && <li className="px-4 py-10 text-center text-sm text-muted">Nessuna conversazione.</li>}
      </ul>
    </div>
  );
}
