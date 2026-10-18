"use client";

import {
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "./ui";

const NAV = [
  { href: "/", label: "Oggi", icon: LayoutDashboard, badge: "actions" as const },
  { href: "/chat", label: "Chat", icon: MessageCircle, badge: "chats" as const },
  { href: "/persone", label: "Persone", icon: Users },
  { href: "/piano", label: "Pianificazione", icon: CalendarRange },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/conti", label: "Conti", icon: Wallet },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
];

const MOBILE = ["/", "/chat", "/persone", "/piano", "/conti"];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Shell({
  children,
  staffName,
  counts,
  logout,
}: {
  children: ReactNode;
  staffName: string;
  counts: { actions: number; chats: number };
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const fullBleed = pathname.startsWith("/chat");

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-2 thin-scroll">
      <p className="label-caps mb-3 px-3 text-muted">Generale</p>
      {NAV.map(({ href, label, icon: Icon, badge }) => {
        const active = isActive(pathname, href);
        const n = badge ? counts[badge] : 0;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium transition-all",
              active ? "bg-pervinca/8 font-semibold text-pervinca-strong dark:text-pervinca" : "text-ink-soft hover:bg-ink/5 hover:text-ink",
            )}
          >
            {active && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-pervinca" />}
            <Icon className={cn("size-[18px]", active ? "text-pervinca" : "text-muted group-hover:text-ink-soft")} />
            <span className="flex-1">{label}</span>
            {n > 0 && <span className="rounded-full bg-pesca-strong px-2 py-0.5 text-[11px] font-bold text-white">{n}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3">
      <Image src="/logo.png" alt="Logo Creattivamente" width={44} height={44} className="rounded-full" priority />
      <div>
        <p className="font-serif text-xl leading-none tracking-tight">Creattivamente</p>
        <p className="label-caps mt-1 text-pesca">Coordinamento</p>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t px-5 py-4">
      <p className="truncate text-sm font-semibold">{staffName}</p>
      <form action={logout}>
        <button className="mt-1 flex items-center gap-2 text-xs text-muted hover:text-ink">
          <LogOut className="size-3.5" /> Esci
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r bg-surface shadow-[4px_0_24px_rgba(0,0,0,0.02)] lg:flex">
        <div className="px-7 py-7">{brand}</div>
        {nav}
        {footer}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Chiudi menu" className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl">
            <div className="flex items-center justify-between px-5 py-5">
              {brand}
              <button aria-label="Chiudi" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-ink/5">
                <X className="size-5" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-paper/85 px-4 py-3 backdrop-blur-md lg:hidden">
          <button aria-label="Apri menu" onClick={() => setOpen(true)} className="rounded-full p-2 hover:bg-ink/5">
            <Menu className="size-5" />
          </button>
          <p className="font-serif text-lg">Creattivamente</p>
          <span className="w-9" />
        </header>
        <main className={cn("flex-1 pb-20 lg:pb-0", fullBleed ? "" : "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10")}>
          {children}
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
          {NAV.filter((n) => MOBILE.includes(n.href)).map(({ href, label, icon: Icon, badge }) => {
            const active = isActive(pathname, href);
            const n = badge ? counts[badge] : 0;
            return (
              <Link key={href} href={href} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold", active ? "text-pervinca-strong" : "text-muted")}>
                <Icon className="size-5" />
                {label === "Pianificazione" ? "Piano" : label}
                {n > 0 && <span className="absolute right-[22%] top-1.5 size-2 rounded-full bg-pesca-strong" />}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
