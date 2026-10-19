"use client";

import { useActionState, type ComponentProps } from "react";

type Props = Omit<ComponentProps<"form">, "action"> & {
  action: (data: FormData) => Promise<void>;
  successMessage?: string;
};

/** For settings actions only (no redirects). Never announces success on rejection. */
export function FeedbackForm({
  action,
  children,
  successMessage = "Modifiche salvate.",
  ...props
}: Props) {
  const [state, submit, pending] = useActionState(
    async (_previous: "" | "success" | "error", data: FormData) => {
      try {
        await action(data);
        return "success" as const;
      } catch {
        return "error" as const;
      }
    },
    "",
  );
  return (
    <form {...props} action={submit} aria-busy={pending}>
      {children}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`col-span-full basis-full text-sm ${!pending && !state ? "sr-only" : ""} ${state === "error" ? "text-danger" : "text-ink-soft"}`}
      >
        {pending
          ? "Operazione in corso…"
          : state === "success"
            ? successMessage
            : state === "error"
              ? "Operazione non completata. Controlla i dati inseriti e la connessione, poi riprova."
              : ""}
      </p>
    </form>
  );
}
