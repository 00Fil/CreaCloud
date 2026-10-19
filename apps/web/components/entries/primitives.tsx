"use client";

import { Check, ArrowRight, Info } from "lucide-react";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button, cn, Input } from "../ui";

export type EntryAction = (data: FormData) => Promise<void>;
export type Option = { value: string; label: string; description?: string };

export function EntrySection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-1 font-serif text-lg text-ink">{title}</legend>
      {description && (
        <p className="text-sm leading-relaxed text-ink-soft">{description}</p>
      )}
      {children}
    </fieldset>
  );
}

/** Native radio semantics and keyboard interaction, custom visual cards. No checkbox UI. */
export function ChoiceCards({
  name,
  label,
  options,
  value,
  defaultValue = "",
  onChange,
  required = true,
  segmented = false,
}: {
  name: string;
  label: string;
  options: Option[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  segmented?: boolean;
}) {
  const [local, setLocal] = useState(defaultValue);
  const current = value ?? local;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold text-ink">{label}</legend>
      <div
        className={
          segmented
            ? "grid gap-2"
            : "grid grid-cols-1 gap-2 @[26rem]:grid-cols-2"
        }
        style={
          segmented
            ? {
                gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
              }
            : undefined
        }
      >
        {options.map((option) => (
          <label key={option.value} className="relative min-w-0 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              required={required}
              checked={current === option.value}
              onChange={() => {
                setLocal(option.value);
                onChange?.(option.value);
              }}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex h-full min-h-14 items-start gap-3 rounded-xl border bg-surface px-3.5 py-3 transition-colors peer-checked:border-pervinca-strong peer-checked:bg-pervinca/10 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pervinca-strong",
                segmented &&
                  "h-full items-center justify-center px-1 text-center",
              )}
            >
              <span
                aria-hidden="true"
                style={segmented ? { display: "none" } : undefined}
                className={cn(
                  segmented && "hidden",
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                  current === option.value
                    ? "border-pervinca-strong bg-pervinca text-[#292524]"
                    : "border-ink-soft/40",
                )}
              >
                {current === option.value && <Check className="size-3.5" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug">
                  {option.label}
                </span>
                {option.description && (
                  <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                    {option.description}
                  </span>
                )}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function MultiChoice({
  name,
  label,
  options,
  defaultValues = [],
  compact = false,
}: {
  name: string;
  label: string;
  options: Option[];
  defaultValues?: string[];
  compact?: boolean;
}) {
  const [selected, setSelected] = useState(defaultValues);
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div
        className={cn(
          "grid gap-2",
          compact
            ? "grid-cols-4 @[26rem]:grid-cols-7"
            : "grid-cols-1 @[26rem]:grid-cols-2",
        )}
      >
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              type="button"
              key={o.value}
              aria-pressed={active}
              onClick={() =>
                setSelected(
                  active
                    ? selected.filter((v) => v !== o.value)
                    : [...selected, o.value],
                )
              }
              className={cn(
                "min-h-12 rounded-xl border p-3 text-left text-sm transition-colors",
                compact && "px-1 text-center",
                active
                  ? "border-pervinca-strong bg-pervinca/10 text-ink"
                  : "bg-surface text-ink-soft hover:border-pervinca",
              )}
            >
              <span
                className={
                  compact
                    ? "block text-center"
                    : "flex items-center justify-between gap-2"
                }
              >
                <span className="font-semibold">{o.label}</span>
                {!compact && (
                  <span aria-hidden="true" className="w-4">
                    {active ? "✓" : "+"}
                  </span>
                )}
              </span>
              {o.description && (
                <span className="mt-1 block leading-relaxed">
                  {o.description}
                </span>
              )}
              {compact && (
                <span aria-hidden="true" className="mt-1 block text-xs">
                  {active ? "✓" : "+"}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      <p className="mt-2 text-xs text-ink-soft">
        {selected.length
          ? `${selected.length} ${compact ? (selected.length === 1 ? "giorno selezionato" : "giorni selezionati") : selected.length === 1 ? "modalità selezionata" : "modalità selezionate"}. Tocca di nuovo per rimuovere.`
          : compact
            ? "Seleziona i giorni in cui vale la fascia. Nessun giorno è selezionato."
            : "Puoi scegliere una o entrambe le modalità."}
      </p>
    </fieldset>
  );
}

export function TeachingModes({
  defaultValues = [],
}: {
  defaultValues?: string[];
}) {
  return (
    <MultiChoice
      name="modes"
      label="Dove può insegnare?"
      defaultValues={defaultValues}
      options={[
        {
          value: "presenza",
          label: "In presenza",
          description: "Lezioni negli spazi del centro.",
        },
        {
          value: "online",
          label: "Online",
          description: "Lezioni a distanza.",
        },
      ]}
    />
  );
}

export function BooleanChoice({
  name,
  label,
  initial,
  positive,
  negative,
  positiveHint,
  negativeHint,
}: {
  name: string;
  label: string;
  initial: boolean;
  positive: string;
  negative: string;
  positiveHint?: string;
  negativeHint?: string;
}) {
  return (
    <ChoiceCards
      name={name}
      label={label}
      defaultValue={initial ? "on" : "off"}
      options={[
        { value: "off", label: negative, description: negativeHint },
        { value: "on", label: positive, description: positiveHint },
      ]}
    />
  );
}

export function EntrySummary({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-pervinca/25 bg-pervinca/8 p-3.5 text-sm leading-relaxed text-ink-soft">
      <Info
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-pervinca-strong"
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EntryForm({
  action,
  children,
  submitLabel,
  successMessage,
  validate,
  className,
  submitVariant = "primary",
}: {
  action: EntryAction;
  children: ReactNode;
  submitLabel: string;
  successMessage: string;
  validate?: (data: FormData) => string | null;
  className?: string;
  submitVariant?: "primary" | "danger";
}) {
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [revision, setRevision] = useState(0);
  const id = useId();
  const saveSucceeded = useRef(false);
  const [state, submit, pending] = useActionState(
    async (_previous: string, data: FormData) => {
      saveSucceeded.current = false;
      try {
        await action(data);
        saveSucceeded.current = true;
        return successMessage;
      } catch (e) {
        // Let Next handle redirecting actions (e.g. new family / tutor).
        if (
          e &&
          typeof e === "object" &&
          "digest" in e &&
          String(e.digest).startsWith("NEXT_REDIRECT")
        )
          throw e;
        setError(
          "Non è stato possibile confermare il salvataggio. Controlla la connessione e verifica l’esito prima di riprovare.",
        );
        return "";
      }
    },
    "",
  );
  // Reset controlled children after React's native form reset, never before it.
  // Otherwise a reset <select> can silently show its first enabled option.
  const wasPending = useRef(false);
  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (wasPending.current && state) {
      setRevision((n) => n + 1);
      setEditing(false);
    }
    wasPending.current = false;
  }, [pending, state]);
  return (
    <form
      action={submit}
      onReset={(event) => {
        if (!saveSucceeded.current) event.preventDefault();
      }}
      noValidate
      className={cn("@container", className)}
      aria-busy={pending}
      aria-describedby={error ? id : undefined}
      onChange={() => {
        setError("");
        setEditing(true);
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button[type="button"]')) {
          setError("");
          setEditing(true);
        }
      }}
      onSubmit={(event) => {
        const form = event.currentTarget;
        const invalid = Array.from(form.elements).find(
          (el): el is HTMLInputElement =>
            el instanceof HTMLInputElement ||
            el instanceof HTMLSelectElement ||
            el instanceof HTMLTextAreaElement
              ? !el.checkValidity()
              : false,
        );
        if (invalid) {
          event.preventDefault();
          invalid.setAttribute("aria-invalid", "true");
          invalid.focus();
          const label =
            (invalid.type === "radio"
              ? invalid.closest("fieldset")?.querySelector("legend")
                  ?.textContent
              : invalid.labels?.[0]?.querySelector(".label-caps")
                  ?.textContent || invalid.labels?.[0]?.textContent
            )?.trim() || invalid.name;
          const detail = invalid.validity.valueMissing
            ? invalid.type === "radio"
              ? "Scegli una delle opzioni."
              : "Questo campo è obbligatorio."
            : invalid.validity.typeMismatch
              ? "Controlla il formato del valore inserito."
              : invalid.validity.rangeUnderflow
                ? `Il valore minimo è ${invalid.min}.`
                : "Usa il formato richiesto dal campo.";
          setError(`Completa o correggi “${label.slice(0, 100)}”. ${detail}`);
          return;
        }
        const message = validate?.(new FormData(form));
        if (message) {
          event.preventDefault();
          setError(message);
        } else setError("");
      }}
      onInput={(event) => {
        const el = event.target as HTMLElement;
        el.removeAttribute("aria-invalid");
      }}
    >
      <fieldset
        disabled={pending}
        className="min-w-0 space-y-5 disabled:opacity-70"
      >
        <div key={revision} className="space-y-5">
          {children}
        </div>
        <div className="border-t pt-4">
          <Button
            type="submit"
            variant={submitVariant}
            className="min-h-14 py-3 w-full justify-between px-5 text-left normal-case tracking-normal text-sm"
          >
            {submitLabel}
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </fieldset>
      <p
        id={id}
        role={error ? "alert" : "status"}
        aria-live="polite"
        className={cn(
          "mt-3 text-sm leading-relaxed",
          error ? "text-danger" : "text-ink-soft",
          !error && !pending && (!state || editing) && "sr-only",
        )}
      >
        {error || (pending ? "Salvataggio in corso…" : editing ? "" : state)}
      </p>
    </form>
  );
}

export function DayDuration() {
  const [extent, setExtent] = useState("");
  return (
    <div className="space-y-3">
      <ChoiceCards
        name="extent"
        label="Quanto dura?"
        value={extent}
        onChange={setExtent}
        options={[
          {
            value: "hours",
            label: "Una fascia oraria",
            description: "Indica inizio e fine.",
          },
          {
            value: "day",
            label: "Giornata intera",
            description: "Dalle 00:00 alle 24:00.",
          },
        ]}
      />
      {extent === "day" && <input type="hidden" name="all_day" value="on" />}
      {extent === "hours" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5 text-sm">
            <span className="block font-semibold">Dalle</span>
            <Input name="start" type="time" required />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block font-semibold">Alle</span>
            <Input name="end" type="time" required />
          </label>
        </div>
      )}
    </div>
  );
}

export function validateDuration(data: FormData) {
  if (!data.get("extent"))
    return "Scegli se indicare una fascia oraria o una giornata intera.";
  if (
    data.get("extent") === "hours" &&
    String(data.get("end")) <= String(data.get("start"))
  )
    return "L’orario di fine deve essere successivo all’inizio.";
  return null;
}
