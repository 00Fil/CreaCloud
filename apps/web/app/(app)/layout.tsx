import { redirect } from "next/navigation";

import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/staff";
import { sessionClient } from "@/lib/db/clients";

async function logout() {
  "use server";
  const db = await sessionClient();
  await db.auth.signOut();
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const db = await sessionClient();
  const [actions, chats] = await Promise.all([
    db.from("pending_actions").select("id", { count: "exact", head: true }).eq("status", "in_attesa"),
    db.from("chats").select("id", { count: "exact", head: true }).eq("needs_attention", true),
  ]);
  return (
    <Shell staffName={staff.name} counts={{ actions: actions.count ?? 0, chats: chats.count ?? 0 }} logout={logout}>
      {children}
    </Shell>
  );
}
