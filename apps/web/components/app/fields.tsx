"use client";

/**
 * Campi dei moduli collegati a react-hook-form, con etichetta, descrizione ed
 * errore già impaginati. Ogni campo conserva il valore nel tipo naturale:
 * testo → string, numero → number | null, euro → centesimi, ora → minuti
 * dalla mezzanotte, data → "AAAA-MM-GG", giorni → number[] (0 = lunedì).
 */

import { CalendarIcon, Check, ChevronsUpDown, X } from "lucide-react";
import * as React from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { centsToInput, formatDateLong, minutesToTime, parseEuroInput, timeToMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface Option<V extends string = string> {
  value: V;
  label: string;
  description?: string;
  /** Testo aggiuntivo per la ricerca (es. numero di telefono). */
  keywords?: string[];
  disabled?: boolean;
}

interface BaseProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Nasconde visivamente l'etichetta (resta per i lettori di schermo). */
  hideLabel?: boolean;
}

function Label({ label, hide, optional }: { label: string; hide?: boolean; optional?: boolean }) {
  return (
    <FormLabel className={cn(hide && "sr-only")}>
      {label}
      {optional ? <span className="font-normal text-muted-foreground"> (facoltativo)</span> : null}
    </FormLabel>
  );
}

// ------------------------------------------------------------------ testo

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  hideLabel,
  optional,
  ...input
}: BaseProps<T> & { optional?: boolean } & Omit<React.ComponentProps<"input">, "name" | "value" | "onChange" | "defaultValue">) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <Label label={label} hide={hideLabel} optional={optional} />
          <FormControl>
            <Input {...input} {...field} value={field.value ?? ""} disabled={disabled ?? input.readOnly} />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  hideLabel,
  optional,
  ...input
}: BaseProps<T> & { optional?: boolean } & Omit<React.ComponentProps<"textarea">, "name" | "value" | "onChange" | "defaultValue">) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <Label label={label} hide={hideLabel} optional={optional} />
          <FormControl>
            <Textarea {...input} {...field} value={field.value ?? ""} disabled={disabled} />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// ------------------------------------------------------------------ numeri

export function NumberField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  hideLabel,
  optional,
  suffix,
  min,
  max,
  step,
  placeholder,
}: BaseProps<T> & {
  optional?: boolean;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <Label label={label} hide={hideLabel} optional={optional} />
          <InputGroup>
            <FormControl>
              <InputGroupInput
                type="number"
                inputMode="decimal"
                min={min}
                max={max}
                step={step}
                placeholder={placeholder}
                disabled={disabled}
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
              />
            </FormControl>
            {suffix ? (
              <InputGroupAddon align="inline-end">
                <InputGroupText>{suffix}</InputGroupText>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Importo in euro, salvato in centesimi (number | null). Accetta "12,50" o "12.50". */
export function MoneyField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  hideLabel,
  optional,
  placeholder = "0,00",
}: BaseProps<T> & { optional?: boolean; placeholder?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => <MoneyInput field={field} {...{ label, description, className, disabled, hideLabel, optional, placeholder }} />}
    />
  );
}

function MoneyInput({
  field,
  label,
  description,
  className,
  disabled,
  hideLabel,
  optional,
  placeholder,
}: {
  field: { name: string; value: number | null; onChange: (v: number | null) => void; onBlur: () => void; ref: React.Ref<HTMLInputElement> };
  label: string;
  description?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  optional?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = React.useState(() => centsToInput(field.value));
  // Allinea il testo quando il valore cambia dall'esterno (reset del modulo).
  const last = React.useRef(field.value);
  React.useEffect(() => {
    if (field.value !== last.current) {
      last.current = field.value;
      setText(centsToInput(field.value));
    }
  }, [field.value]);
  return (
    <FormItem className={className}>
      <Label label={label} hide={hideLabel} optional={optional} />
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>€</InputGroupText>
        </InputGroupAddon>
        <FormControl>
          <InputGroupInput
            inputMode="decimal"
            autoComplete="off"
            placeholder={placeholder}
            disabled={disabled}
            name={field.name}
            ref={field.ref}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const cents = parseEuroInput(e.target.value);
              last.current = cents;
              field.onChange(cents);
            }}
            onBlur={() => {
              setText(centsToInput(last.current));
              field.onBlur();
            }}
          />
        </FormControl>
      </InputGroup>
      {description ? <FormDescription>{description}</FormDescription> : null}
      <FormMessage />
    </FormItem>
  );
}

// ------------------------------------------------------------------ ora e data

/** Orario "HH:MM", salvato in minuti dalla mezzanotte (number | null). */
export function TimeField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  hideLabel,
  optional,
  step = 300,
}: BaseProps<T> & { optional?: boolean; step?: number }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <Label label={label} hide={hideLabel} optional={optional} />
          <FormControl>
            <Input
              type="time"
              step={step}
              disabled={disabled}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={field.value == null ? "" : minutesToTime(field.value)}
              onChange={(e) => field.onChange(timeToMinutes(e.target.value))}
              className="tabular-nums"
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Data "AAAA-MM-GG" (string | null) scelta da calendario. */
export function DateField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  hideLabel,
  optional,
  placeholder = "Scegli una data",
  fromDate,
  toDate,
  clearable,
}: BaseProps<T> & {
  optional?: boolean;
  placeholder?: string;
  fromDate?: string;
  toDate?: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const value: string | null = field.value || null;
        const selected = value ? isoToDate(value) : undefined;
        return (
          <FormItem className={className}>
            <Label label={label} hide={hideLabel} optional={optional} />
            <div className="flex gap-1.5">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disabled}
                      className={cn("flex-1 justify-start font-normal", !value && "text-muted-foreground")}
                      ref={field.ref}
                      onBlur={field.onBlur}
                    >
                      <CalendarIcon className="text-muted-foreground" />
                      {value ? formatDateLong(value) : placeholder}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selected}
                    defaultMonth={selected}
                    captionLayout="dropdown"
                    disabled={[
                      ...(fromDate ? [{ before: isoToDate(fromDate) }] : []),
                      ...(toDate ? [{ after: isoToDate(toDate) }] : []),
                    ]}
                    onSelect={(d) => {
                      field.onChange(d ? dateToIso(d) : null);
                      setOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
              {clearable && value ? (
                <Button type="button" variant="ghost" size="icon" aria-label="Togli la data" onClick={() => field.onChange(null)}>
                  <X />
                </Button>
              ) : null}
            </div>
            {description ? <FormDescription>{description}</FormDescription> : null}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ------------------------------------------------------------------ scelte

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  hideLabel,
  optional,
  options,
  placeholder = "Scegli…",
}: BaseProps<T> & { optional?: boolean; options: Option[]; placeholder?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <Label label={label} hide={hideLabel} optional={optional} />
          <Select value={field.value == null ? "" : String(field.value)} onValueChange={field.onChange} disabled={disabled}>
            <FormControl>
              <SelectTrigger className="w-full" ref={field.ref} onBlur={field.onBlur}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Scelta con ricerca, per elenchi lunghi (persone, materie). */
export function ComboboxField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  hideLabel,
  optional,
  options,
  placeholder = "Scegli…",
  searchPlaceholder = "Cerca…",
  emptyText = "Nessun risultato",
  clearable,
}: BaseProps<T> & {
  optional?: boolean;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const current = options.find((o) => o.value === field.value);
        return (
          <FormItem className={className}>
            <Label label={label} hide={hideLabel} optional={optional} />
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    className={cn("w-full justify-between font-normal", !current && "text-muted-foreground")}
                  >
                    <span className="truncate">{current?.label ?? placeholder}</span>
                    <ChevronsUpDown className="opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
                <Command>
                  <CommandInput placeholder={searchPlaceholder} />
                  <CommandList>
                    <CommandEmpty>{emptyText}</CommandEmpty>
                    <CommandGroup>
                      {clearable && current ? (
                        <CommandItem
                          value="__nessuno__"
                          onSelect={() => {
                            field.onChange(null);
                            setOpen(false);
                          }}
                        >
                          <X className="text-muted-foreground" />
                          Nessuno
                        </CommandItem>
                      ) : null}
                      {options.map((o) => (
                        <CommandItem
                          key={o.value}
                          value={`${o.label} ${o.value}`}
                          keywords={o.keywords}
                          disabled={o.disabled}
                          onSelect={() => {
                            field.onChange(o.value);
                            setOpen(false);
                          }}
                        >
                          <Check className={cn(o.value === field.value ? "opacity-100" : "opacity-0")} />
                          <div className="min-w-0">
                            <div className="truncate">{o.label}</div>
                            {o.description ? <div className="truncate text-xs text-muted-foreground">{o.description}</div> : null}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {description ? <FormDescription>{description}</FormDescription> : null}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/** Opzioni come schede selezionabili (poche scelte, con descrizione). */
export function RadioCardsField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  hideLabel,
  options,
  columns = 2,
}: BaseProps<T> & { options: Option[]; columns?: 1 | 2 | 3 }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <Label label={label} hide={hideLabel} />
          <FormControl>
            <RadioGroup
              value={field.value == null ? "" : String(field.value)}
              onValueChange={field.onChange}
              disabled={disabled}
              className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}
            >
              {options.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                >
                  <RadioGroupItem value={o.value} disabled={o.disabled} className="mt-0.5" />
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium">{o.label}</span>
                    {o.description ? <span className="text-xs text-muted-foreground">{o.description}</span> : null}
                  </span>
                </label>
              ))}
            </RadioGroup>
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Pulsanti a scelta singola (es. modalità presenza/online). */
export function SegmentedField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  hideLabel,
  options,
}: BaseProps<T> & { options: Option[] }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <Label label={label} hide={hideLabel} />
          <FormControl>
            <ToggleGroup
              type="single"
              variant="outline"
              value={field.value == null ? "" : String(field.value)}
              onValueChange={(v) => v && field.onChange(v)}
              disabled={disabled}
              className="w-full flex-wrap"
            >
              {options.map((o) => (
                <ToggleGroupItem key={o.value} value={o.value} disabled={o.disabled} className="flex-1">
                  {o.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

const WEEKDAY_OPTIONS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const WEEKDAY_NAMES = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];

/** Giorni della settimana (number[], 0 = lunedì). */
export function WeekdaysField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  hideLabel,
  days = [0, 1, 2, 3, 4, 5, 6],
}: BaseProps<T> & { days?: number[] }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <Label label={label} hide={hideLabel} />
          <FormControl>
            <ToggleGroup
              type="multiple"
              variant="outline"
              value={((field.value as number[] | null) ?? []).map(String)}
              onValueChange={(v) => field.onChange(v.map(Number).sort((a, b) => a - b))}
              disabled={disabled}
              className="w-full flex-wrap"
            >
              {days.map((d) => (
                <ToggleGroupItem key={d} value={String(d)} aria-label={WEEKDAY_NAMES[d]} className="flex-1">
                  {WEEKDAY_OPTIONS[d]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Più scelte con caselle (string[]), per elenchi brevi come i livelli scolastici. */
export function CheckboxGroupField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  hideLabel,
  options,
  columns = 2,
}: BaseProps<T> & { options: Option[]; columns?: 1 | 2 | 3 }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const values: string[] = field.value ?? [];
        return (
          <FormItem className={className}>
            <Label label={label} hide={hideLabel} />
            <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}>
              {options.map((o) => (
                <label key={o.value} className="flex cursor-pointer items-center gap-2.5 rounded-md py-1 text-sm">
                  <Checkbox
                    checked={values.includes(o.value)}
                    disabled={disabled || o.disabled}
                    onCheckedChange={(checked) =>
                      field.onChange(checked ? [...values, o.value] : values.filter((v) => v !== o.value))
                    }
                  />
                  {o.label}
                </label>
              ))}
            </div>
            {description ? <FormDescription>{description}</FormDescription> : null}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/** Interruttore sì/no con testo esplicativo, impaginato come riga. */
export function SwitchField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
}: BaseProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("flex items-center justify-between gap-4 rounded-lg border p-3", className)}>
          <div className="grid gap-1">
            <FormLabel>{label}</FormLabel>
            {description ? <FormDescription>{description}</FormDescription> : null}
          </div>
          <FormControl>
            <Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={disabled} ref={field.ref} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

/** Casella singola sì/no. */
export function CheckboxField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
}: BaseProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("flex items-start gap-3", className)}>
          <FormControl>
            <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} disabled={disabled} ref={field.ref} />
          </FormControl>
          <div className="grid gap-1 leading-none">
            <FormLabel className="font-normal">{label}</FormLabel>
            {description ? <FormDescription>{description}</FormDescription> : null}
          </div>
        </FormItem>
      )}
    />
  );
}

/** Due campi affiancati su desktop, impilati su telefono. */
export function FieldRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("grid gap-5 sm:grid-cols-2", className)}>{children}</div>;
}

/** Gruppo di campi con titolo, per moduli lunghi. */
export function FieldSet({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className={cn("grid gap-4", className)}>
      <legend className="mb-1">
        <span className="label-caps text-muted-foreground">{title}</span>
        {description ? <span className="mt-1 block text-sm text-muted-foreground">{description}</span> : null}
      </legend>
      {children}
    </fieldset>
  );
}
