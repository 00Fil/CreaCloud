"use client";

import { GraduationCap, MessageCircle, Plus, UserRound, Users, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { searchIndex, type SearchItem } from "@/app/(app)/actions/search";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";

import { NAV_ITEMS, QUICK_CREATE } from "./nav";

const OPEN_EVENT = "creacloud:cerca";

/** Apre la ricerca rapida da qualsiasi punto dell'app. */
export function openCommandMenu() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const KIND: Record<SearchItem["kind"], { group: string; icon: LucideIcon }> = {
  famiglia: { group: "Famiglie", icon: Users },
  studente: { group: "Studenti", icon: GraduationCap },
  genitore: { group: "Genitori", icon: UserRound },
  tutor: { group: "Tutor", icon: UserRound },
  chat: { group: "Chat", icon: MessageCircle },
};

/** Ricerca rapida (Ctrl+K / ⌘K): pagine, azioni, persone e chat. */
export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<SearchItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // L'indice si carica all'apertura e si rinnova a ogni apertura successiva.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    searchIndex()
      .then((res) => !cancelled && setItems(res))
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const groups = React.useMemo(() => {
    const map = new Map<string, SearchItem[]>();
    for (const it of items ?? []) {
      const g = KIND[it.kind].group;
      map.set(g, [...(map.get(g) ?? []), it]);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Ricerca rapida" description="Cerca persone, chat e pagine">
      <CommandInput placeholder="Cerca persone, chat, pagine…" />
      <CommandList className="max-h-[min(70dvh,480px)]">
        <CommandEmpty>{loading ? "Caricamento…" : "Nessun risultato."}</CommandEmpty>
        <CommandGroup heading="Pagine">
          {NAV_ITEMS.map((n) => (
            <CommandItem key={n.href} value={`pagina ${n.label} ${n.keywords ?? ""}`} onSelect={() => go(n.href)}>
              <n.icon />
              {n.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Nuovo">
          {QUICK_CREATE.map((q) => (
            <CommandItem key={q.href} value={`nuovo nuova crea aggiungi ${q.label} ${q.description}`} onSelect={() => go(q.href)}>
              <Plus />
              <span>
                Nuovo: {q.label.toLowerCase()}
                <span className="ml-2 text-xs text-muted-foreground">{q.description}</span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        {loading && !items ? (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            <Spinner /> Carico persone e chat…
          </div>
        ) : null}
        {groups.map(([group, list]) => (
          <React.Fragment key={group}>
            <CommandSeparator />
            <CommandGroup heading={group}>
              {list.map((it) => {
                const Icon = KIND[it.kind].icon;
                return (
                  <CommandItem key={`${it.kind}-${it.id}`} value={`${it.label} ${it.sub} ${it.kind}-${it.id}`} onSelect={() => go(it.href)}>
                    <Icon />
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    <span className="max-w-[45%] truncate text-xs text-muted-foreground">{it.sub}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
