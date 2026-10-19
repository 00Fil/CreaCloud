"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

import { isActive, NAV_GROUPS } from "./nav";
import { useNavCounts } from "./nav-counts";
import { NavUser, type NavUserProps } from "./nav-user";

export function AppSidebar({ user }: { user: NavUserProps }) {
  const pathname = usePathname();
  const counts = useNavCounts();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Creattivamente">
              <Link href="/" onClick={() => setOpenMobile(false)}>
                <Image src="/logo.png" alt="" width={32} height={32} className="size-8 shrink-0 rounded-full" priority />
                <span className="grid leading-tight">
                  <span className="font-heading text-base font-medium">Creattivamente</span>
                  <span className="label-caps text-pesca-strong">Coordinamento</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const count = item.count ? counts[item.count] : 0;
                  const active = isActive(pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link href={item.href} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {count > 0 ? (
                        <SidebarMenuBadge className="rounded-full bg-pesca-strong px-1.5 text-white peer-data-[active=true]/menu-button:text-white">
                          {count > 99 ? "99+" : count}
                          <span className="sr-only"> {item.count === "actions" ? "da approvare" : "da leggere"}</span>
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser {...user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
