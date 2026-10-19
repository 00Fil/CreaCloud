"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

import { openCommandMenu } from "./command-menu";
import { isActive, NAV_ITEMS, QUICK_CREATE } from "./nav";

export function SiteHeader() {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((n) => isActive(pathname, n.href));
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <span className="truncate text-sm font-medium">{current?.label ?? "Creattivamente"}</span>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          className="h-9 w-9 justify-start px-0 text-muted-foreground sm:w-64 sm:px-3"
          onClick={openCommandMenu}
          aria-label="Cerca (Ctrl+K)"
        >
          <Search className="mx-auto sm:mx-0" />
          <span className="hidden sm:inline">Cerca persone, chat…</span>
          <Kbd className="ml-auto hidden sm:inline-flex">Ctrl K</Kbd>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="sm:w-auto sm:px-3" aria-label="Nuovo">
              <Plus />
              <span className="hidden sm:inline">Nuovo</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="label-caps text-muted-foreground">Aggiungi</DropdownMenuLabel>
            {QUICK_CREATE.map((q) => (
              <DropdownMenuItem key={q.href} asChild>
                <Link href={q.href} className="flex flex-col items-start gap-0">
                  <span>{q.label}</span>
                  <span className="text-xs text-muted-foreground">{q.description}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
