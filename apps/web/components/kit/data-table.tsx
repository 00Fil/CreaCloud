"use client";

import { ArrowDown, ArrowUp, ChevronRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { cn } from "../ui";

export type Column = {
  key: string;
  header: string;
  align?: "right";
  sortable?: boolean;
  hideOnMobile?: boolean;
  className?: string;
};
export type Row = {
  id: string;
  href?: string;
  /** testo in cui cerca il campo di ricerca */
  search: string;
  /** valore usato per ordinare ogni colonna */
  sort?: Record<string, string | number>;
  /** valore dei filtri a pillola */
  filter?: string;
  cells: Record<string, ReactNode>;
  /** riga compatta mostrata su telefono al posto della tabella */
  mobile?: ReactNode;
  /** azione rapida accanto alla scheda su telefono (es. un pannello) */
  action?: ReactNode;
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Tabella con ricerca, ordinamento e filtri immediati. Su telefono diventa un
 * elenco di schede. Cliccando una riga si apre il dettaglio.
 */
export function DataTable({
  columns,
  rows,
  placeholder = "Cerca",
  filters,
  empty = "Nessun risultato.",
  toolbar,
  initialSort,
}: {
  columns: Column[];
  rows: Row[];
  placeholder?: string;
  filters?: { value: string; label: string }[];
  empty?: ReactNode;
  toolbar?: ReactNode;
  initialSort?: { key: string; dir: 1 | -1 };
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);
  const shown = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    const list = rows.filter(
      (r) =>
        (!filter || r.filter === filter) &&
        terms.every((t) => norm(r.search).includes(t)),
    );
    if (!sort) return list;
    return [...list].sort((a, b) => {
      const x = a.sort?.[sort.key] ?? "";
      const y = b.sort?.[sort.key] ?? "";
      return (
        (typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "it")) * sort.dir
      );
    });
  }, [rows, q, filter, sort]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows)
      if (r.filter) m.set(r.filter, (m.get(r.filter) ?? 0) + 1);
    return m;
  }, [rows]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">{placeholder}</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="min-h-11 w-full rounded-full border bg-surface pl-10 pr-4 text-sm placeholder:text-muted focus:border-pervinca focus:outline-none focus:ring-4 focus:ring-pervinca/15"
          />
        </label>
        {filters && (
          <div
            role="group"
            aria-label="Filtra"
            className="thin-scroll flex gap-1.5 overflow-x-auto"
          >
            {[{ value: "", label: "Tutti" }, ...filters].map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors",
                  filter === f.value
                    ? "border-pervinca bg-pervinca/12 text-pervinca-strong dark:text-pervinca"
                    : "text-ink-soft hover:bg-ink/5",
                )}
              >
                {f.label}
                <span className="tabular-nums text-muted">
                  {f.value ? (counts.get(f.value) ?? 0) : rows.length}
                </span>
              </button>
            ))}
          </div>
        )}
        {toolbar && (
          <div className="ml-auto flex flex-wrap gap-2">{toolbar}</div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {shown.length} risultati
      </p>

      <div className="overflow-hidden rounded-2xl border bg-surface shadow-soft">
        {/* telefono: schede */}
        <ul className="divide-y md:hidden">
          {shown.map((r) => (
            <li key={r.id} className="flex items-center gap-1 pr-2">
              {r.href ? (
                <button
                  type="button"
                  onClick={() => router.push(r.href!)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left active:bg-ink/5"
                >
                  <div className="min-w-0 flex-1">
                    {r.mobile ?? r.cells[columns[0].key]}
                  </div>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted"
                  />
                </button>
              ) : (
                <div className="min-w-0 flex-1 px-4 py-3.5">
                  {r.mobile ?? r.cells[columns[0].key]}
                </div>
              )}
              {r.action}
            </li>
          ))}
        </ul>
        {/* computer: tabella */}
        <div className="thin-scroll hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-2/60">
                {columns.map((c) => {
                  const on = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={
                        on
                          ? sort!.dir === 1
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      className={cn(
                        "label-caps whitespace-nowrap px-4 py-3 font-bold text-muted",
                        c.align === "right" ? "text-right" : "text-left",
                        c.className,
                      )}
                    >
                      {c.sortable ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSort(
                              on
                                ? { key: c.key, dir: sort!.dir === 1 ? -1 : 1 }
                                : { key: c.key, dir: 1 },
                            )
                          }
                          className="inline-flex items-center gap-1 uppercase hover:text-ink"
                        >
                          {c.header}
                          {on &&
                            (sort!.dir === 1 ? (
                              <ArrowUp className="size-3" />
                            ) : (
                              <ArrowDown className="size-3" />
                            ))}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
                {rows.some((r) => r.href) && (
                  <th aria-hidden="true" className="w-8" />
                )}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r.id}
                  onClick={(e) => {
                    if (
                      !r.href ||
                      (e.target as HTMLElement).closest(
                        "a,button,input,select,textarea,form,dialog",
                      )
                    )
                      return;
                    router.push(r.href);
                  }}
                  className={cn(
                    "border-b last:border-0",
                    r.href && "cursor-pointer hover:bg-pervinca/[0.05]",
                  )}
                >
                  {columns.map((c, i) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-4 py-3 align-middle",
                        c.align === "right" && "text-right tabular-nums",
                        c.className,
                      )}
                    >
                      {i === 0 && r.href ? (
                        <a
                          href={r.href}
                          onClick={(e) => {
                            e.preventDefault();
                            router.push(r.href!);
                          }}
                          className="font-semibold hover:underline"
                        >
                          {r.cells[c.key]}
                        </a>
                      ) : (
                        r.cells[c.key]
                      )}
                    </td>
                  ))}
                  {r.href && (
                    <td className="pr-3 text-muted">
                      <ChevronRight aria-hidden="true" className="size-4" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!shown.length && (
          <p className="px-5 py-12 text-center text-sm text-muted">{empty}</p>
        )}
      </div>
    </div>
  );
}
