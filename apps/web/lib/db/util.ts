import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "./types";

export type Db = SupabaseClient<Database>;

export function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}

/** Valore da salvare in una colonna jsonb (oggetti del dominio già serializzabili). */
export function asJson(value: unknown): NonNullable<Json> {
  return value as NonNullable<Json>;
}
