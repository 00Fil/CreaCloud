/**
 * Azioni server tipizzate: input validato con zod, staff verificato, errori
 * restituiti come risultato (mai lanciati al client) e messaggi in italiano.
 *
 *   "use server";
 *   export const createRoom = action(roomSchema, async (input, { db, staff }) => {
 *     ok(await db.from("rooms").insert(input), "creazione aula");
 *     revalidatePath("/impostazioni");
 *   });
 */

import "server-only";

import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";

import { requireStaff, type StaffSession } from "@/lib/auth/staff";
import { sessionClient } from "@/lib/db/clients";
import type { Db } from "@/lib/db/util";

import type { ActionResult, FieldErrors } from "./result";

export type { ActionResult, FieldErrors } from "./result";

export interface ActionContext {
  staff: StaffSession;
  db: Db;
}

/** Errore previsto, mostrato così com'è all'utente (eventualmente su un campo). */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

const PG_MESSAGES: Record<string, string> = {
  "23505": "Esiste già un elemento con questi dati.",
  "23503": "È collegato ad altri dati: rimuovi prima quelli.",
  "23514": "Alcuni valori non sono validi.",
  "23502": "Manca un dato obbligatorio.",
  "42501": "Non hai i permessi per questa operazione.",
  PGRST116: "Elemento non trovato: forse è stato eliminato.",
};

interface DbResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/** Restituisce i dati di una risposta Supabase o lancia un ActionError leggibile. */
export function ok<T>(res: DbResponse<T>, what: string): T {
  if (res.error) {
    console.error(`[azione] ${what}:`, res.error);
    const known = res.error.code ? PG_MESSAGES[res.error.code] : undefined;
    throw new ActionError(known ?? `Operazione non riuscita (${what}).`);
  }
  return res.data as T;
}

function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

/** Definisce un'azione server con input validato e risultato tipizzato. */
export function action<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.output<S>, ctx: ActionContext) => Promise<T>,
): (input: z.input<S>) => Promise<ActionResult<Awaited<T>>> {
  return async (input) => {
    try {
      const staff = await requireStaff();
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        return { ok: false, error: "Controlla i campi evidenziati.", fieldErrors: fieldErrorsOf(parsed.error) };
      }
      const db = await sessionClient();
      const data = await handler(parsed.data, { staff, db });
      return { ok: true, data: (data ?? null) as Awaited<T> };
    } catch (error) {
      // redirect() e notFound() devono arrivare a Next.js
      unstable_rethrow(error);
      if (error instanceof ActionError) return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
      console.error("[azione] errore imprevisto:", error);
      return { ok: false, error: "Si è verificato un errore imprevisto. Riprova tra poco." };
    }
  };
}
