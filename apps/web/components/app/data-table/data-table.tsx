"use client";

import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type Row,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { FacetedFilter, type FacetOption } from "./faceted-filter";
import { TablePagination } from "./pagination";

export { ColumnHeader } from "./column-header";
export type { FacetOption } from "./faceted-filter";

/** Testo senza accenti e in minuscolo, per cercare "nicolo" e trovare "Nicolò". */
export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Filtro per le colonne a faccette: il valore della cella è tra quelli scelti. */
export const facetFilter: FilterFn<unknown> = (row, id, value: string[] | undefined) => {
  if (!value?.length) return true;
  const cell = row.getValue(id);
  return Array.isArray(cell) ? cell.some((c) => value.includes(String(c))) : value.includes(String(cell));
};

export interface Facet {
  /** id della colonna (o accessorKey) da filtrare. */
  column: string;
  title: string;
  options: FacetOption[];
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  data: TData[];
  getRowId?: (row: TData) => string;
  /** Testo su cui cercare per ogni riga; senza, la ricerca è nascosta. */
  searchText?: (row: TData) => string;
  searchPlaceholder?: string;
  facets?: Facet[];
  initialSorting?: SortingState;
  initialHidden?: string[];
  /** Righe per pagina; 0 = tutte. */
  pageSize?: number;
  /** Destinazione al clic su una riga (Ctrl/⌘+clic apre in una nuova scheda). */
  rowHref?: (row: TData) => string;
  onRowClick?: (row: TData) => void;
  /** Riga come scheda su telefono. Senza, su telefono si scorre la tabella. */
  mobileCard?: (row: TData) => React.ReactNode;
  /** Mostrato quando non ci sono righe (prima di ogni filtro). */
  empty?: React.ReactNode;
  /** Pulsanti a destra della ricerca. */
  toolbar?: React.ReactNode;
  rowClassName?: (row: TData) => string | undefined;
  className?: string;
}

const INTERACTIVE = "a,button,input,select,textarea,label,[role=menuitem],[role=checkbox],[role=switch],[role=dialog],[data-row-stop]";

/**
 * Tabella con ricerca senza accenti, filtri a faccette, ordinamento,
 * paginazione e schede su telefono. Le colonne si definiscono con TanStack Table.
 */
export function DataTable<TData>({
  columns,
  data,
  getRowId,
  searchText,
  searchPlaceholder = "Cerca…",
  facets = [],
  initialSorting = [],
  initialHidden = [],
  pageSize = 25,
  rowHref,
  onRowClick,
  mobileCard,
  empty,
  toolbar,
  rowClassName,
  className,
}: DataTableProps<TData>) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() =>
    Object.fromEntries(initialHidden.map((id) => [id, false])),
  );
  const [globalFilter, setGlobalFilter] = React.useState("");

  // Le colonne con faccette usano il filtro "valore tra quelli scelti".
  const facetIds = facets.map((f) => f.column).join(",");
  const cols = React.useMemo(() => {
    const ids = new Set(facetIds.split(","));
    return columns.map((c) => {
      const id = c.id ?? ("accessorKey" in c ? String(c.accessorKey) : undefined);
      return id && ids.has(id) && !c.filterFn ? { ...c, filterFn: facetFilter as FilterFn<TData> } : c;
    });
  }, [columns, facetIds]);

  const searchIndex = React.useMemo(() => {
    if (!searchText) return null;
    return new Map(data.map((row) => [row, normalizeSearch(searchText(row))]));
  }, [data, searchText]);

  const table = useReactTable({
    data,
    columns: cols,
    getRowId,
    state: { sorting, columnFilters, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row: Row<TData>, _id, value: string) => {
      const q = normalizeSearch(String(value ?? "").trim());
      if (!q) return true;
      const text = searchIndex?.get(row.original) ?? "";
      return q.split(/\s+/).every((part) => text.includes(part));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    ...(pageSize ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    initialState: pageSize ? { pagination: { pageIndex: 0, pageSize } } : undefined,
    autoResetPageIndex: true,
  });

  const filtered = globalFilter !== "" || columnFilters.length > 0;
  const rows = table.getRowModel().rows;
  const clickable = !!(rowHref || onRowClick);

  const activate = (row: TData, e: React.MouseEvent | React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    if (rowHref) {
      const href = rowHref(row);
      if ("metaKey" in e && (e.metaKey || e.ctrlKey)) window.open(href, "_blank");
      else router.push(href);
    } else onRowClick?.(row);
  };
  const rowProps = (row: TData) =>
    clickable
      ? {
          tabIndex: 0,
          role: rowHref ? "link" : "button",
          onClick: (e: React.MouseEvent) => activate(row, e),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && e.target === e.currentTarget) activate(row, e);
          },
          onMouseEnter: rowHref ? () => router.prefetch(rowHref(row)) : undefined,
        }
      : {};

  if (!data.length && empty) return <>{empty}</>;

  const showToolbar = searchText || facets.length > 0 || toolbar;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {showToolbar ? (
        <div className="flex flex-wrap items-center gap-2">
          {searchText ? (
            <InputGroup className="w-full sm:w-72">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
            </InputGroup>
          ) : null}
          {facets.map((f) => {
            const column = table.getColumn(f.column);
            return column ? <FacetedFilter key={f.column} column={column} title={f.title} options={f.options} /> : null;
          })}
          {filtered ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setGlobalFilter("");
                setColumnFilters([]);
              }}
            >
              Azzera
              <X />
            </Button>
          ) : null}
          {toolbar ? <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{toolbar}</div> : null}
        </div>
      ) : null}

      {isMobile && mobileCard ? (
        <ul className="grid gap-2">
          {rows.length ? (
            rows.map((row) => (
              <li
                key={row.id}
                {...rowProps(row.original)}
                className={cn(
                  "rounded-xl border bg-card p-3 text-card-foreground shadow-xs",
                  clickable && "cursor-pointer transition-colors active:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  rowClassName?.(row.original),
                )}
              >
                {mobileCard(row.original)}
              </li>
            ))
          ) : (
            <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nessun risultato con questi filtri.</li>
          )}
        </ul>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader className="bg-muted/40">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="h-10 text-xs text-muted-foreground"
                      style={header.column.columnDef.size !== 150 ? { width: header.column.columnDef.size } : undefined}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    {...rowProps(row.original)}
                    className={cn(
                      clickable && "cursor-pointer focus-visible:bg-accent/50 focus-visible:outline-none",
                      rowClassName?.(row.original),
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-28 text-center text-muted-foreground">
                    {filtered ? "Nessun risultato con questi filtri." : "Nessun elemento."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {pageSize ? <TablePagination table={table} /> : null}
    </div>
  );
}
