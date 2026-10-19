"use client";

import { trapDialogFocus } from "@/lib/ui/dialog";

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
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "./ui";

const NAV = [
  {
    href: "/",
    label: "Oggi",
    icon: LayoutDashboard,
    badge: "actions" as const,
  },
  {
    href: "/chat",
    label: "Chat",
    icon: MessageCircle,
    badge: "chats" as const,
  },
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
  const menu = useRef<HTMLDialogElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const dialog = menu.current;
    if (!dialog) return;
    if (!open) {
      dialog.close();
      return;
    }
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    closeOnDesktop();
    return () => {
      document.body.style.overflow = previous;
      desktop.removeEventListener("change", closeOnDesktop);
      dialog.close();
    };
  }, [open]);
  const fullBleed = pathname.startsWith("/chat");

  const nav = (
    <nav
      aria-label="Navigazione principale"
      className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-2 thin-scroll"
    >
      <p className="label-caps mb-3 px-3 text-muted">Generale</p>
      {NAV.map(({ href, label, icon: Icon, badge }) => {
        const active = isActive(pathname, href);
        const n = badge ? counts[badge] : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium transition-all",
              active
                ? "bg-pervinca/8 font-semibold text-pervinca-strong dark:text-pervinca"
                : "text-ink-soft hover:bg-ink/5 hover:text-ink",
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-pervinca" />
            )}
            <Icon
              aria-hidden="true"
              className={cn(
                "size-[18px]",
                active
                  ? "text-pervinca"
                  : "text-muted group-hover:text-ink-soft",
              )}
            />
            <span className="flex-1">{label}</span>
            {n > 0 && (
              <span className="rounded-full bg-pesca-strong px-2 py-0.5 text-[11px] font-bold text-[#292524]">
                {n}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3">
      <Image
        src="/logo.png"
        alt="Logo Creattivamente"
        width={44}
        height={44}
        className="rounded-full"
        priority
      />
      <div>
        <p className="font-serif text-xl leading-none tracking-tight">
          Creattivamente
        </p>
        <p className="label-caps mt-1 text-pesca">Coordinamento</p>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t px-5 py-4">
      <p className="truncate text-sm font-semibold">{staffName}</p>
      <form action={logout}>
        <button className="mt-1 flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink">
          <LogOut aria-hidden="true" className="size-3.5" /> Esci
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

      <a href="#main-content" className="skip-link">
        Vai al contenuto
      </a>
      <dialog
        onKeyDown={trapDialogFocus}
        ref={menu}
        id="mobile-menu"
        aria-label="Menu di navigazione"
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        className="ux-menu fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[90vw] border-0 bg-surface p-0 text-ink shadow-xl"
        onClick={(event) => {
          if (
            event.target === event.currentTarget &&
            event.clientX > event.currentTarget.getBoundingClientRect().right
          )
            setOpen(false);
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-1 px-4 py-5">
            {brand}
            <button
              type="button"
              aria-label="Chiudi menu"
              autoFocus
              onClick={() => setOpen(false)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-ink/5"
            >
              <X className="size-5" />
            </button>
          </div>
          {nav}
          {footer}
        </div>
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b bg-paper/85 px-4 py-2 backdrop-blur-md lg:hidden">
          <button
            type="button"
            aria-label="Apri menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
            className="flex size-11 items-center justify-center rounded-full hover:bg-ink/5"
          >
            <Menu className="size-5" />
          </button>
          <p className="font-serif text-lg">Creattivamente</p>
          <span className="w-9" />
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "flex-1 lg:pb-0",
            fullBleed
              ? "pb-[calc(64px+env(safe-area-inset-bottom))]"
              : "pb-[calc(80px+env(safe-area-inset-bottom))] " +
                  "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10",
          )}
        >
          {children}
        </main>
        <nav
          aria-label="Navigazione rapida"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          {NAV.filter((n) => MOBILE.includes(n.href)).map(
            ({ href, label, icon: Icon, badge }) => {
              const active = isActive(pathname, href);
              const n = badge ? counts[badge] : 0;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-16 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold",
                    active ? "text-pervinca-strong" : "text-muted",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" />
                  {label === "Pianificazione" ? "Piano" : label}
                  {n > 0 && <span className="sr-only"> · {n} da seguire</span>}
                  {n > 0 && (
                    <span className="absolute right-[22%] top-1.5 size-2 rounded-full bg-pesca-strong" />
                  )}
                </Link>
              );
            },
          )}
        </nav>
      </div>
    </div>
  );
}
