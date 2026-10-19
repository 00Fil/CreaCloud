"use client";

import { unstable_rethrow } from "next/navigation";
import { useCallback, useRef, useTransition } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/actions/result";

export interface UseActionOptions<T> {
  /** Messaggio di conferma; nessun toast se omesso. */
  success?: string | ((data: T) => string);
  onSuccess?: (data: T) => void;
  onError?: (result: Extract<ActionResult<T>, { ok: false }>) => void;
  /** Mostra l'errore in un toast (predefinito: sì). */
  toastError?: boolean;
}

/**
 * Esegue un'azione server tipizzata con stato di attesa e notifiche.
 *
 *   const { execute, pending } = useAction(deleteRoom, { success: "Aula eliminata" });
 *   <Button disabled={pending} onClick={() => execute({ id })}>Elimina</Button>
 */
export function useAction<I, T>(
  fn: (input: I) => Promise<ActionResult<T>>,
  options: UseActionOptions<T> = {},
) {
  const [pending, startTransition] = useTransition();
  const opts = useRef(options);
  opts.current = options;

  const execute = useCallback(
    (input: I) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          let result: ActionResult<T>;
          try {
            result = await fn(input);
          } catch (error) {
            unstable_rethrow(error);
            result = { ok: false, error: "Connessione non riuscita. Controlla la rete e riprova." };
          }
          const o = opts.current;
          if (result.ok) {
            const message = typeof o.success === "function" ? o.success(result.data) : o.success;
            if (message) toast.success(message);
            o.onSuccess?.(result.data);
          } else {
            if (o.toastError !== false) toast.error(result.error);
            o.onError?.(result);
          }
          resolve(result);
        });
      }),
    [fn],
  );

  return { execute, pending };
}
