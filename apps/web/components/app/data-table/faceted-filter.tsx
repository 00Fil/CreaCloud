"use client";

import type { Column } from "@tanstack/react-table";
import { Check, PlusCircle } from "lucide-react";
import type * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface FacetOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/** Filtro a scelta multipla su una colonna, con conteggi. */
export function FacetedFilter<TData, TValue>({
  column,
  title,
  options,
}: {
  column: Column<TData, TValue>;
  title: string;
  options: FacetOption[];
}) {
  const counts = column.getFacetedUniqueValues();
  const selected = new Set((column.getFilterValue() as string[] | undefined) ?? []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          <PlusCircle />
          {title}
          {selected.size > 0 ? (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                {selected.size}
              </Badge>
              <div className="hidden gap-1 lg:flex">
                {selected.size > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selected.size} scelti
                  </Badge>
                ) : (
                  options
                    .filter((o) => selected.has(o.value))
                    .map((o) => (
                      <Badge variant="secondary" key={o.value} className="rounded-sm px-1 font-normal">
                        {o.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>Nessun risultato</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const isSelected = selected.has(o.value);
                return (
                  <CommandItem
                    key={o.value}
                    onSelect={() => {
                      const next = new Set(selected);
                      if (isSelected) next.delete(o.value);
                      else next.add(o.value);
                      column.setFilterValue(next.size ? Array.from(next) : undefined);
                    }}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-[4px] border",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input [&_svg]:invisible",
                      )}
                    >
                      <Check className="size-3.5 text-current" />
                    </span>
                    {o.icon ? <o.icon className="size-4 text-muted-foreground" /> : null}
                    <span>{o.label}</span>
                    {counts.get(o.value) ? (
                      <span className="ml-auto font-mono text-xs text-muted-foreground">{counts.get(o.value)}</span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.size > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => column.setFilterValue(undefined)} className="justify-center text-center">
                    Togli i filtri
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
