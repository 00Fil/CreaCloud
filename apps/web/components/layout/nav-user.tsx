"use client";

import { Check, ChevronsUpDown, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";

import { PersonAvatar } from "@/components/app/person-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

export interface NavUserProps {
  name: string;
  role: "titolare" | "coordinatore";
  email: string;
  logout: () => Promise<void>;
}

const THEMES = [
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "dark", label: "Scuro", icon: Moon },
  { value: "system", label: "Come il dispositivo", icon: Monitor },
] as const;

export function NavUser({ name, role, email, logout }: NavUserProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <PersonAvatar name={name} size="sm" className="size-8 rounded-lg" />
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{role === "titolare" ? "Titolare" : "Coordinamento"}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
            <DropdownMenuLabel className="font-normal">
              <div className="grid text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="label-caps py-1 text-muted-foreground">Tema</DropdownMenuLabel>
              {THEMES.map((t) => (
                <DropdownMenuItem key={t.value} onSelect={() => setTheme(t.value)}>
                  <t.icon />
                  {t.label}
                  {theme === t.value ? <Check className="ml-auto" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/impostazioni" onClick={() => setOpenMobile(false)}>
                <Settings />
                Impostazioni
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
              <LogOut />
              Esci
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
