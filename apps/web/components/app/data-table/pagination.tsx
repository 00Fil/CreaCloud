"use client";

import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TablePagination<TData>({ table, pageSizes = [10, 25, 50, 100] }: { table: Table<TData>; pageSizes?: number[] }) {
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  if (total <= pageSizes[0]) return null;
  const from = pageIndex * pageSize + 1;
  const to = Math.min(total, from + pageSize - 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {from}–{to} di {total}
      </span>
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 sm:flex">
          <span>Righe</span>
          <Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger size="sm" className="w-[72px]" aria-label="Righe per pagina">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizes.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" className="hidden sm:inline-flex" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="Prima pagina">
            <ChevronsLeft />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Pagina precedente">
            <ChevronLeft />
          </Button>
          <span className="px-2 tabular-nums">
            {pageIndex + 1} / {table.getPageCount()}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Pagina successiva">
            <ChevronRight />
          </Button>
          <Button variant="outline" size="icon-sm" className="hidden sm:inline-flex" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} aria-label="Ultima pagina">
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
