"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm, type DefaultValues, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { ResponsivePanel, type ResponsivePanelProps } from "@/components/app/responsive-panel";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import type { ActionResult } from "@/lib/actions/result";

type Schema = z.ZodType<FieldValues, FieldValues>;

export interface FormPanelProps<S extends Schema, T> extends Omit<ResponsivePanelProps, "footer" | "children"> {
  schema: S;
  defaultValues: DefaultValues<z.input<S>>;
  /** Azione server creata con `action()`: riceve i valori grezzi del modulo. */
  action: (input: z.input<S>) => Promise<ActionResult<T>>;
  success?: string | ((data: T) => string);
  onSuccess?: (data: T) => void;
  submitLabel?: string;
  /** Contenuto extra a sinistra nel piede (es. pulsante Elimina). */
  extraFooter?: React.ReactNode;
  /** Resta aperto dopo il salvataggio (es. per inserimenti in serie). */
  keepOpen?: boolean;
  children: (form: UseFormReturn<z.input<S>, unknown, z.output<S>>) => React.ReactNode;
}

/**
 * Modulo in un pannello laterale: validazione immediata con zod, salvataggio
 * con un'azione server tipizzata, errori del server riportati sui campi.
 */
export function FormPanel<S extends Schema, T>({
  schema,
  defaultValues,
  action,
  success = "Salvato",
  onSuccess,
  submitLabel = "Salva",
  extraFooter,
  keepOpen = false,
  open: openProp,
  onOpenChange,
  children,
  ...panel
}: FormPanelProps<S, T>) {
  const [openState, setOpenState] = React.useState(false);
  const open = openProp ?? openState;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOpenState(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );
  const formId = React.useId();

  const form = useForm<z.input<S>, unknown, z.output<S>>({
    // zodResolver è tipizzato sul singolo schema: qui lo schema è generico.
    resolver: zodResolver(schema as never) as never,
    defaultValues,
  });

  // Riparte dai valori iniziali a ogni apertura.
  const defaultsKey = JSON.stringify(defaultValues);
  React.useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultsKey]);

  const { execute, pending } = useAction(action, {
    success,
    onSuccess: (data) => {
      if (keepOpen) form.reset(defaultValues);
      else setOpen(false);
      onSuccess?.(data);
    },
    onError: (result) => {
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as Path<z.input<S>>, { type: "server", message });
      }
    },
  });

  // I valori grezzi vanno al server, che li valida di nuovo con lo stesso schema.
  const submit = form.handleSubmit(async () => {
    await execute(form.getValues());
  });

  return (
    <ResponsivePanel
      {...panel}
      open={open}
      onOpenChange={setOpen}
      footer={
        <>
          {extraFooter ? <div className="mr-auto flex items-center gap-2">{extraFooter}</div> : null}
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Annulla
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? <Spinner /> : null}
            {submitLabel}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form id={formId} onSubmit={submit} className="grid gap-5" noValidate>
          {children(form)}
        </form>
      </Form>
    </ResponsivePanel>
  );
}
