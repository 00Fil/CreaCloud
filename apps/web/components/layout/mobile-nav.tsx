"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { isActive, MOBILE_NAV, NAV_ITEMS } from "./nav";
import { useNavCounts } from "./nav-counts";

/** Barra in basso su telefono: le pagine di tutti i giorni a portata di pollice. */
export function MobileNav() {
  const pathname = usePathname();
  const counts = useNavCounts();
  const { setOpenMobile } = useSidebar();
  const items = MOBILE_NAV.map((href) => NAV_ITEMS.find((n) => n.href === href)!);
  return (
    <nav
      aria-label="Navigazione principale"
      className="grid shrink-0 grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const count = item.count ? counts[item.count] : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
              active && "text-primary",
            )}
          >
            <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-accent")}>
              <item.icon className="size-5" />
            </span>
            {item.label}
            {count > 0 ? (
              <span className="absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-pesca-strong px-1 text-center text-[10px] leading-4 text-white">
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
      >
        <span className="grid h-7 w-12 place-items-center rounded-full">
          <Menu className="size-5" />
        </span>
        Altro
      </button>
    </nav>
  );
}
