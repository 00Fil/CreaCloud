import type * as React from "react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Riquadro con titolo, descrizione e azioni: il mattone delle pagine di dettaglio. */
export function Section({
  title,
  description,
  actions,
  className,
  contentClassName,
  children,
  id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <Card id={id} className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle className="font-heading text-lg font-medium">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {actions ? <CardAction className="flex items-center gap-2">{actions}</CardAction> : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

/** Coppie etichetta/valore per i riepiloghi (anagrafica, dettagli lezione). */
export function DetailList({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{it.label}</dt>
          <dd className="mt-0.5 truncate text-sm font-medium">{it.value || <span className="font-normal text-muted-foreground">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
