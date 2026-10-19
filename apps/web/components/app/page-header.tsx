import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Intestazione di pagina: titolo, descrizione, azioni principali a destra
 * (sotto il titolo su telefono) e collegamento per tornare indietro.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  /** Riga sotto il titolo con badge o dati brevi. */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1.5">
        {back ? (
          <Link
            href={back.href}
            className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChevronLeft className="size-4" />
            {back.label}
          </Link>
        ) : null}
        <h1 className="font-heading text-3xl leading-tight text-balance sm:text-[2rem]">{title}</h1>
        {description ? <p className="max-w-2xl text-pretty text-muted-foreground">{description}</p> : null}
        {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div> : null}
    </header>
  );
}

/** Contenitore standard delle pagine: larghezza massima e spaziatura verticale. */
export function PageBody({ className, children, wide }: { className?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8", wide ? "max-w-[1600px]" : "max-w-6xl", className)}>
      {children}
    </div>
  );
}
