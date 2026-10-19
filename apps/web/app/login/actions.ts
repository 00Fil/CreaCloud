"use server";

import { redirect } from "next/navigation";

import { sessionClient } from "@/lib/db/clients";

export type LoginState = { error: string | null; email: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Inserisci email e password.", email };
  const db = await sessionClient();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email o password non corrette.", email };
  const next = String(formData.get("next") ?? "/");
  // solo percorsi interni: niente "//host" o "/\host", che il browser tratta come altri siti
  redirect(/^\/(?![/\\])/.test(next) ? next : "/");
}
