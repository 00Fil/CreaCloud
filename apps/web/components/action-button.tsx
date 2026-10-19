"use client";

import { trapDialogFocus } from "@/lib/ui/dialog";

import { LoaderCircle } from "lucide-react";
import { useId, useRef, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";

export type ActionButtonProps = ComponentProps<"button"> & {
  confirmMessage?: string;
  confirmLabel?: string;
};

/** Keeps form actions and submitter name/value intact; no extra HTTP requests. */
export function ActionButton({
  children,
  disabled,
  type = "submit",
  confirmMessage,
  confirmLabel = "Conferma",
  onClick,
  ...props
}: ActionButtonProps) {
  const { pending, data, action } = useFormStatus();
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const approved = useRef(false);
  const id = useId();
  const busy = type === "submit" && pending;
  const active =
    busy &&
    (props.name
      ? data?.get(props.name) === props.value
      : !props.formAction || props.formAction === action);
  return (
    <>
      <button
        {...props}
        ref={button}
        type={type}
        disabled={disabled || busy}
        aria-busy={active || undefined}
        data-pressable="true"
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          if (
            confirmMessage &&
            !approved.current &&
            button.current?.form?.checkValidity()
          ) {
            event.preventDefault();
            dialog.current?.showModal();
          }
        }}
      >
        {active && (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        )}
        {children}
        {active && (
          <span className="sr-only"> · Operazione in corso, attendi</span>
        )}
      </button>
      {confirmMessage && (
        <dialog
          onKeyDown={trapDialogFocus}
          ref={dialog}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
          className="ux-dialog m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border bg-surface p-6 text-ink shadow-soft"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              const r = event.currentTarget.getBoundingClientRect();
              if (
                event.clientX < r.left ||
                event.clientX > r.right ||
                event.clientY < r.top ||
                event.clientY > r.bottom
              )
                dialog.current?.close();
            }
          }}
        >
          <h2 id={`${id}-title`} className="font-serif text-2xl">
            Confermi l’operazione?
          </h2>
          <p
            id={`${id}-description`}
            className="mt-3 text-sm leading-relaxed text-ink-soft"
          >
            {confirmMessage}
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              autoFocus
              className="min-h-11 rounded-full border px-5 text-sm font-semibold hover:bg-ink/5"
              onClick={() => dialog.current?.close()}
            >
              Torna indietro
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-paper hover:opacity-90"
              onClick={() => {
                dialog.current?.close();
                approved.current = true;
                try {
                  button.current?.form?.requestSubmit(button.current);
                } finally {
                  approved.current = false;
                }
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
