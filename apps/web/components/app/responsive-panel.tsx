"use client";

import * as React from "react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface ResponsivePanelProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Elemento che apre il pannello (deve accettare ref e onClick). */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pulsanti in basso, sempre visibili. */
  footer?: React.ReactNode;
  /** Larghezza su desktop. */
  size?: "default" | "lg" | "xl";
  className?: string;
  children: React.ReactNode;
}

const WIDTH = {
  default: "sm:max-w-md",
  lg: "sm:max-w-xl",
  xl: "sm:max-w-3xl",
} as const;

/**
 * Pannello laterale su desktop, pannello dal basso su telefono.
 * Usato per creare e modificare senza lasciare la pagina.
 */
export function ResponsivePanel({
  title,
  description,
  trigger,
  open,
  onOpenChange,
  footer,
  size = "default",
  className,
  children,
}: ResponsivePanelProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading text-xl">{title}</DrawerTitle>
            {description ? <DrawerDescription>{description}</DrawerDescription> : null}
          </DrawerHeader>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin", className)}>
            {children}
          </div>
          {footer ? <DrawerFooter className="border-t bg-background">{footer}</DrawerFooter> : null}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent className={cn("flex w-full flex-col gap-0 p-0", WIDTH[size])}>
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="font-heading text-xl">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5 scrollbar-thin", className)}>{children}</div>
        {footer ? <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  );
}
