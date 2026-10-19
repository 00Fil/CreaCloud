import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { sessionClient } from "@/lib/db/clients";

export interface StaffSession {
  userId: string;
  name: string;
  email: string;
  role: "titolare" | "coordinatore";
}

/** Coordinatore autenticato, o redirect al login. */
export const requireStaff = cache(async (): Promise<StaffSession> => {
  const db = await sessionClient();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: staff } = await db.from("staff").select("full_name, role").eq("id", data.user.id).maybeSingle();
  if (!staff) redirect("/login?errore=non_abilitato");
  return { userId: data.user.id, email: data.user.email ?? "", name: staff.full_name as string, role: staff.role as StaffSession["role"] };
});
