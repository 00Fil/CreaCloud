"use client";

import {
  CalendarDays,
  CalendarRange,
  CornerDownLeft,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  Plus,
  Search,
  Settings,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { searchIndex, type SearchItem } from "@/app/(app)/actions/search";
import { trapDialogFocus } from "@/lib/ui/dialog";

import { cn } from "../ui";

const OPEN = "creacloud:search";

export function openSearch() {
  window.dispatchEvent(new Event(OPEN));
}

type Entry = {
  id: string;
  group: string;
  label: string;
  sub?: string;
  href: string;
  icon: LucideIcon;
  keywords?: string;
};

const COMMANDS: Entry[] = [
  {
    id: "new-family",
    group: "Azioni",
    label: "Nuova famiglia",
    sub: "Genitore e figli",
    href: "/persone?nuova=famiglia",
    icon: Plus,
    keywords: "aggiungi crea iscrivi",
  },
  {
    id: "new-tutor",
    group: "Azioni",
    label: "Nuovo tutor",
    href: "/persone?tab=tutor&nuova=tutor",
    icon: Plus,
    keywords: "aggiungi crea insegnante",
  },
  {
    id: "plan",
    group: "Azioni",
    label: "Calcola il piano del mese",
    href: "/piano",
    icon: CalendarRange,
    keywords: "pianifica motore bozza",
  },
  {
    id: "pay",
    group: "Azioni",
    label: "Registra un pagamento",
    href: "/conti",
    icon: Wallet,
    keywords: "incasso contanti compenso",
  },
  {
    id: "p-oggi",
    group: "Pagine",
    label: "Oggi",
    href: "/",
    icon: LayoutDashboard,
    keywords: "home approvazioni",
  },
  {
    id: "p-chat",
    group: "Pagine",
    label: "Chat",
    href: "/chat",
    icon: MessageCircle,
    keywords: "whatsapp messaggi",
  },
  {
    id: "p-cal",
    group: "Pagine",
    label: "Calendario",
    href: "/calendario",
    icon: CalendarDays,
    keywords: "lezioni settimana",
  },
  {
    id: "p-persone",
    group: "Pagine",
    label: "Persone",
    href: "/persone",
    icon: Users,
    keywords: "famiglie tutor anagrafiche",
  },
  {
    id: "p-piano",
    group: "Pagine",
    label: "Pianificazione",
    href: "/piano",
    icon: CalendarRange,
  },
  {
    id: "p-conti",
    group: "Pagine",
    label: "Conti",
    href: "/conti",
    icon: Wallet,
    keywords: "pagamenti soldi",
  },
  {
    id: "p-imp",
    group: "Pagine",
    label: "Impostazioni",
    href: "/impostazioni",
    icon: Settings,
    keywords: "whatsapp orari materie",
  },
];

const KIND: Record<SearchItem["kind"], { group: string; icon: LucideIcon }> = {
  famiglia: { group: "Famiglie", icon: Users },
  studente: { group: "Studenti", icon: GraduationCap },
  genitore: { group: "Genitori", icon: UserRound },
  tutor: { group: "Tutor", icon: UserRound },
  chat: { group: "Chat", icon: MessageCircle },
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Ricerca globale: persone, chat, pagine e azioni. Si apre con Ctrl+K o ⌘K. */
export function CommandPalette() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<SearchItem[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const id = useId();

  useEffect(() => {
    const show = () => setOpen(true);
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener(OPEN, show);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener(OPEN, show);
      window.removeEventListener("keydown", key);
    };
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
      setQ("");
      setCursor(0);
      input.current?.focus();
      // sempre aggiornato: nuove persone o chat compaiono subito
      searchIndex().then(setIndex, () => setIndex([]));
    } else if (d.open) d.close();
  }, [open]);

  const results = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    const people: Entry[] = (index ?? []).map((i) => ({
      id: `${i.kind}-${i.id}`,
      group: KIND[i.kind].group,
      label: i.label,
      sub: i.sub,
      href: i.href,
      icon: KIND[i.kind].icon,
    }));
    const all = terms.length ? [...COMMANDS, ...people] : COMMANDS;
    const match = (e: Entry) =>
      terms.every((t) =>
        norm(`${e.label} ${e.sub ?? ""} ${e.keywords ?? ""}`).includes(t),
      );
    const found = all.filter(match);
    // prima chi inizia con la ricerca
    if (terms.length)
      found.sort(
        (a, b) =>
          Number(norm(b.label).startsWith(terms[0])) -
          Number(norm(a.label).startsWith(terms[0])),
      );
    const order = [
      "Azioni",
      "Famiglie",
      "Studenti",
      "Genitori",
      "Tutor",
      "Chat",
      "Pagine",
    ];
    return found
      .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
      .slice(0, 40);
  }, [q, index]);

  const go = (e: Entry | undefined) => {
    if (!e) return;
    setOpen(false);
    router.push(e.href);
  };

  let lastGroup = "";
  return (
    <dialog
      ref={ref}
      aria-label="Ricerca rapida"
      onKeyDown={trapDialogFocus}
      onClose={() => setOpen(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      className="ux-dialog mx-auto mb-auto mt-[8vh] w-[calc(100%-1.5rem)] max-w-xl overflow-hidden rounded-3xl border bg-surface p-0 text-ink shadow-2xl"
    >
      <div className="flex items-center gap-3 border-b px-5">
        <Search aria-hidden="true" className="size-5 shrink-0 text-muted" />
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-activedescendant={
            results[cursor] ? `${id}-${results[cursor].id}` : undefined
          }
          aria-label="Cerca persone, chat, pagine e azioni"
          value={q}
          placeholder="Cerca una famiglia, uno studente, un tutor…"
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(results[cursor]);
            }
          }}
          className="min-h-16 flex-1 bg-transparent text-base placeholder:text-muted focus:outline-none"
        />
        <kbd className="hidden rounded-md border px-1.5 py-0.5 text-[11px] text-muted sm:block">
          Esc
        </kbd>
      </div>
      <ul
        id={`${id}-list`}
        role="listbox"
        aria-label="Risultati"
        className="thin-scroll max-h-[60vh] overflow-y-auto p-2"
      >
        {results.map((e, i) => {
          const header = e.group !== lastGroup ? e.group : null;
          lastGroup = e.group;
          const Icon = e.icon;
          return (
            <li key={e.id} role="presentation">
              {header && (
                <p className="label-caps px-3 pb-1.5 pt-3 text-muted">
                  {header}
                </p>
              )}
              <div
                id={`${id}-${e.id}`}
                role="option"
                aria-selected={i === cursor}
                onMouseMove={() => setCursor(i)}
                onClick={() => go(e)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5",
                  i === cursor && "bg-pervinca/12",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink/5">
                  <Icon aria-hidden="true" className="size-4 text-ink-soft" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {e.label}
                  </span>
                  {e.sub && (
                    <span className="block truncate text-xs text-muted">
                      {e.sub}
                    </span>
                  )}
                </span>
                {i === cursor && (
                  <CornerDownLeft
                    aria-hidden="true"
                    className="size-4 text-muted"
                  />
                )}
              </div>
            </li>
          );
        })}
        {q && index === null && (
          <li className="px-3 py-6 text-center text-sm text-muted">
            Carico l&apos;elenco…
          </li>
        )}
        {q && index !== null && !results.length && (
          <li className="px-3 py-6 text-center text-sm text-muted">
            Nessun risultato per «{q}».
          </li>
        )}
      </ul>
    </dialog>
  );
}

export function SearchButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label={compact ? "Cerca" : undefined}
      className={cn(
        compact
          ? "flex size-11 items-center justify-center rounded-full hover:bg-ink/5"
          : "flex min-h-11 w-full items-center gap-2.5 rounded-xl border bg-paper px-3.5 text-sm text-muted transition-colors hover:border-pervinca/50 hover:text-ink",
        className,
      )}
    >
      <Search aria-hidden="true" className="size-4" />
      {!compact && (
        <>
          <span className="flex-1 text-left">Cerca</span>
          <kbd className="rounded-md border bg-surface px-1.5 text-[11px] font-semibold">
            Ctrl K
          </kbd>
        </>
      )}
    </button>
  );
}
