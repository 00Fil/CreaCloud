"use client";

import { useId, useRef, useState, type ReactNode } from "react";

import { cn } from "../ui";

export type TabItem = {
  id: string;
  label: ReactNode;
  badge?: ReactNode;
  content: ReactNode;
  icon?: ReactNode;
};

/**
 * Schede di una pagina: tutto il contenuto è già caricato, il cambio è immediato.
 * La scheda scelta resta nell'indirizzo (?tab=…) per ricarica e condivisione.
 */
export function Tabs({
  items,
  initial,
  param = "tab",
  vertical = false,
  className,
}: {
  items: TabItem[];
  initial?: string;
  param?: string;
  vertical?: boolean;
  className?: string;
}) {
  const [active, setActive] = useState(
    items.some((i) => i.id === initial) ? initial! : items[0]?.id,
  );
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (next: string, focus = false) => {
    setActive(next);
    const url = new URL(window.location.href);
    if (next === items[0]?.id) url.searchParams.delete(param);
    else url.searchParams.set(param, next);
    window.history.replaceState(window.history.state, "", url);
    if (focus) refs.current[items.findIndex((i) => i.id === next)]?.focus();
  };
  return (
    <div
      className={cn(
        "min-w-0",
        vertical
          ? "grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]"
          : "flex flex-col gap-5",
        className,
      )}
    >
      <div
        role="tablist"
        aria-orientation={vertical ? "vertical" : "horizontal"}
        className={cn(
          "thin-scroll flex gap-1 overflow-x-auto",
          vertical
            ? "lg:sticky lg:top-6 lg:h-fit lg:flex-col lg:overflow-visible"
            : "border-b",
        )}
        onKeyDown={(e) => {
          const keys = vertical
            ? ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
            : ["ArrowLeft", "ArrowRight"];
          if (!keys.includes(e.key) && e.key !== "Home" && e.key !== "End")
            return;
          e.preventDefault();
          const i = items.findIndex((t) => t.id === active);
          const n =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? items.length - 1
                : e.key === "ArrowLeft" || e.key === "ArrowUp"
                  ? i - 1
                  : i + 1;
          select(items[(n + items.length) % items.length].id, true);
        }}
      >
        {items.map((t, i) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`${id}-panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => select(t.id)}
              className={cn(
                "relative flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap px-3.5 text-sm font-semibold transition-colors",
                vertical
                  ? cn(
                      "rounded-xl lg:w-full",
                      on
                        ? "bg-pervinca/12 text-pervinca-strong dark:text-pervinca"
                        : "text-ink-soft hover:bg-ink/5",
                    )
                  : cn(
                      "-mb-px border-b-2",
                      on
                        ? "border-pervinca text-ink"
                        : "border-transparent text-muted hover:text-ink",
                    ),
              )}
            >
              {t.icon}
              {t.label}
              {t.badge !== undefined && t.badge !== null && t.badge !== 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums",
                    on
                      ? "bg-pervinca/20 text-pervinca-strong dark:text-pervinca"
                      : "bg-ink/5 text-ink-soft",
                  )}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {items.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${id}-panel-${t.id}`}
          aria-labelledby={`${id}-tab-${t.id}`}
          hidden={t.id !== active}
          className="min-w-0"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
