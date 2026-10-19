"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Chiede conferma prima di un'azione irreversibile o con effetti esterni
 * (eliminare, inviare messaggi). Resta aperto finché `onConfirm` non finisce.
 */
export function Confirm({
  trigger,
  title,
  description,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  destructive,
  onConfirm,
  open: openProp,
  onOpenChange,
  children,
}: {
  trigger?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Restituisci false per lasciare aperta la finestra (es. errore). */
  onConfirm: () => unknown | Promise<unknown>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Contenuto extra (es. un campo per una nota). */
  children?: React.ReactNode;
}) {
  const [openState, setOpenState] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    if (openProp === undefined) setOpenState(v);
    onOpenChange?.(v);
  };
  return (
    <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className={cn(destructive && buttonVariants({ variant: "destructive" }))}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const result = await onConfirm();
                if (result !== false) setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
