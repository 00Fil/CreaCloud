"use client";

import type { ComponentProps } from "react";

import { useSheet } from "./sheet";
import { toast } from "./toast";

/**
 * Modulo semplice (azione del server) che conferma con una notifica e, se è
 * dentro un pannello, lo chiude dopo il salvataggio.
 */
export function SheetForm({
  action,
  success = "Modifiche salvate",
  ...props
}: Omit<ComponentProps<"form">, "action"> & {
  action: (data: FormData) => Promise<void>;
  success?: string;
}) {
  const sheet = useSheet();
  return (
    <form
      {...props}
      action={async (data) => {
        try {
          await action(data);
        } catch (e) {
          if (
            e &&
            typeof e === "object" &&
            "digest" in e &&
            String(e.digest).startsWith("NEXT_REDIRECT")
          )
            throw e;
          toast(
            "Salvataggio non riuscito. Controlla la connessione e riprova.",
            "error",
          );
          return;
        }
        toast(success);
        sheet?.close();
      }}
    />
  );
}
