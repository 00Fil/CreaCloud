"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "../ui";

type Toast = { id: number; message: string; tone: "ok" | "error" };

const EVENT = "creacloud:toast";

/** Mostra una notifica breve in basso. Utilizzabile da qualsiasi componente client. */
export function toast(message: string, tone: Toast["tone"] = "ok") {
  if (typeof window === "undefined" || !message) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, tone } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    let seq = 0;
    const onToast = (e: Event) => {
      const { message, tone } = (e as CustomEvent<Omit<Toast, "id">>).detail;
      const id = ++seq;
      setItems((list) => [...list.slice(-2), { id, message, tone }]);
      setTimeout(
        () => setItems((list) => list.filter((t) => t.id !== id)),
        tone === "error" ? 8000 : 4000,
      );
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-8"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={cn(
            "ux-reveal pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-surface px-4 py-3 text-sm shadow-soft",
            t.tone === "error" && "border-danger/30",
          )}
        >
          {t.tone === "ok" ? (
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-ok"
            />
          ) : (
            <CircleAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-danger"
            />
          )}
          <p className="flex-1 leading-snug">{t.message}</p>
          <button
            type="button"
            aria-label="Chiudi notifica"
            className="-m-1 rounded-full p-1 text-muted hover:text-ink"
            onClick={() =>
              setItems((list) => list.filter((x) => x.id !== t.id))
            }
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
