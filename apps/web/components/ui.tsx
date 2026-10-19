import { clsx, type ClassValue } from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { ActionButton, type ActionButtonProps } from "./action-button";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Variant =
  "default" | "primary" | "accent" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  default:
    "bg-ink text-paper hover:opacity-90 shadow-lg shadow-ink/10 hover:-translate-y-0.5",
  primary:
    "bg-pervinca text-[#292524] hover:bg-pervinca-strong shadow-md shadow-pervinca/20 hover:-translate-y-0.5",
  accent:
    "bg-pesca-strong text-[#292524] hover:bg-pesca-deep shadow-md shadow-pesca-strong/20 hover:-translate-y-0.5",
  outline: "border border-ink/10 bg-transparent text-ink hover:bg-ink/5",
  ghost: "text-ink/70 hover:bg-ink/5 hover:text-ink",
  danger:
    "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400",
};

const sizes: Record<Size, string> = {
  sm: "min-h-11 px-3.5 text-xs gap-1.5",
  md: "min-h-11 px-5 text-xs gap-2",
  lg: "h-12 px-7 text-[12px] gap-2.5",
};

export function buttonClass(
  variant: Variant = "default",
  size: Size = "md",
  className?: string,
) {
  return cn(
    "inline-flex min-w-11 max-w-full shrink-0 select-none items-center justify-center whitespace-normal text-center rounded-full font-bold uppercase tracking-[0.15em] transition-[color,background-color,border-color,opacity,transform,box-shadow] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ActionButtonProps & { variant?: Variant; size?: Size }) {
  return (
    <ActionButton
      className={buttonClass(variant, size, className)}
      {...props}
    />
  );
}

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link
      data-pressable="true"
      className={buttonClass(variant, size, className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/40 bg-surface/90 shadow-soft backdrop-blur-md dark:border-white/5",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-lg leading-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = "neutral" | "pervinca" | "pesca" | "ok" | "warn" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-ink/5 text-ink-soft",
  pervinca: "bg-pervinca/12 text-pervinca-strong dark:text-pervinca",
  pesca: "bg-pesca/15 text-pesca-deep dark:text-pesca",
  ok: "bg-ok/10 text-ok",
  warn: "bg-warn/10 text-warn",
  danger: "bg-danger/10 text-danger",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

const field =
  "min-h-11 min-w-0 w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger transition focus:border-pervinca focus:outline-none focus:ring-4 focus:ring-pervinca/15";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(field, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(field, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(field, "min-h-20", className)} {...props} />;
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="label-caps text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function PageHeader({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="label-caps mb-1.5 text-pesca">{eyebrow}</p>}
        <h1 className="text-3xl leading-tight sm:text-4xl">{title}</h1>
        {children && (
          <div className="mt-2 text-sm text-ink-soft">{children}</div>
        )}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </header>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "pesca" | "pervinca" | "warn";
}) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="label-caps text-muted">{label}</p>
      <p
        className={cn(
          "mt-2 font-serif text-3xl leading-none",
          tone === "pesca" && "text-pesca-deep dark:text-pesca",
          tone === "pervinca" && "text-pervinca-strong dark:text-pervinca",
          tone === "warn" && "text-warn",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-5 py-10 text-center text-sm text-muted">{children}</p>
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div
      className="thin-scroll overflow-x-auto"
      role="region"
      aria-label={
        props["aria-label"] ??
        "Tabella, scorri orizzontalmente per vedere tutte le colonne"
      }
      tabIndex={0}
    >
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "label-caps whitespace-nowrap px-4 py-3 text-left font-bold text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return (
    <td className={cn("border-t px-4 py-3 align-top", className)} {...props} />
  );
}

export function PriorityBadge({ priority }: { priority: number }) {
  const map: Record<number, [string, Tone]> = {
    1: ["P1 inderogabile", "danger"],
    2: ["P2 importante", "pesca"],
    3: ["P3 preferenza", "pervinca"],
    4: ["P4 gradimento", "neutral"],
  };
  const [label, tone] = map[priority] ?? [`P${priority}`, "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}
