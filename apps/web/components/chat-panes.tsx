"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "./ui";

/** Su telefono mostra la lista oppure la conversazione; su desktop entrambe. */
export function ChatPanes({
  list,
  children,
}: {
  list: ReactNode;
  children: ReactNode;
}) {
  const open = useSelectedLayoutSegment() !== null;
  return (
    <div className="flex h-[calc(100dvh-64px-64px-env(safe-area-inset-bottom))] lg:h-dvh">
      <div
        className={cn(
          "w-full shrink-0 border-r bg-surface lg:block lg:w-[360px]",
          open && "hidden",
        )}
      >
        {list}
      </div>
      <div className={cn("min-w-0 flex-1", !open && "hidden lg:flex")}>
        {children}
      </div>
    </div>
  );
}
