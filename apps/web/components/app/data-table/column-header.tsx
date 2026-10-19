"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** Intestazione di colonna ordinabile con un clic (crescente → decrescente → nessuno). */
export function ColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}) {
  if (!column.getCanSort()) return <span className={className}>{title}</span>;
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className={cn(
        "-ml-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-left font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        sorted && "text-foreground",
        className,
      )}
      aria-label={`${title}: ordina`}
    >
      {title}
      <Icon className={cn("size-3.5", !sorted && "opacity-40")} />
    </button>
  );
}
