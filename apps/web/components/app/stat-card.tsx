import Link from "next/link";
import type * as React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONES = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-pervinca-soft text-accent-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  pesca: "bg-pesca-soft text-pesca-strong",
  destructive: "bg-destructive/10 text-destructive",
} as const;

/** Numero chiave con etichetta, icona e nota; cliccabile se ha `href`. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof TONES;
  href?: string;
  className?: string;
}) {
  const body = (
    <Card
      className={cn(
        "gap-3 p-4 sm:p-5",
        href && "transition-colors hover:border-primary/40 hover:bg-accent/30",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        {Icon ? (
          <span className={cn("grid size-8 place-items-center rounded-lg", TONES[tone])}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <div className="font-heading text-3xl leading-none tabular-nums">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}
