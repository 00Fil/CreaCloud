import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "./types";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`variabile d'ambiente mancante: ${name}`);
  return v;
}

let service: SupabaseClient<Database> | null = null;

/** Client con service role: solo lato server, per webhook, agente e motore. */
export function serviceClient(): SupabaseClient<Database> {
  service ??= createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return service;
}

/** Client legato alla sessione del coordinatore (RLS: solo staff). */
export async function sessionClient(): Promise<SupabaseClient<Database>> {
  const store = await cookies();
  return createServerClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // chiamato da un Server Component: il middleware rinnova i cookie
        }
      },
    },
  });
}

export { must, type Db } from "./util";
