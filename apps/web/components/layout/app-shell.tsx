"use client";

import { usePathname } from "next/navigation";
import type * as React from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { AppSidebar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";
import { MobileNav } from "./mobile-nav";
import { NavCountsProvider } from "./nav-counts";
import type { NavUserProps } from "./nav-user";
import { SiteHeader } from "./site-header";

/**
 * Struttura dell'app: menu laterale (a scomparsa su telefono), intestazione con
 * ricerca e "Nuovo", contenuto che scorre e barra in basso su telefono.
 * Il contenuto occupa tutta l'altezza disponibile: le pagine a schermo pieno
 * (chat) usano `h-full`, le altre scorrono normalmente.
 */
export function AppShell({
  user,
  counts,
  defaultOpen,
  children,
}: {
  user: NavUserProps;
  counts: { actions: number; chats: number };
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Dentro una conversazione su telefono serve tutto lo schermo.
  const inConversation = /^\/chat\/[^/]+/.test(pathname);
  return (
    <NavCountsProvider initial={counts}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <a href="#contenuto" className="skip-link">
          Vai al contenuto
        </a>
        <AppSidebar user={user} />
        <SidebarInset className="h-dvh overflow-hidden md:h-[calc(100dvh-1rem)]">
          <SiteHeader />
          <div id="contenuto" tabIndex={-1} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin focus:outline-none">
            {children}
          </div>
          {inConversation ? null : <MobileNav />}
        </SidebarInset>
        <CommandMenu />
      </SidebarProvider>
    </NavCountsProvider>
  );
}
