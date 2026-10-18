import type { SupabaseClient } from "@supabase/supabase-js";

export type Db = SupabaseClient;

export function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}
