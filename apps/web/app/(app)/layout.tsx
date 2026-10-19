import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
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
  const [actions, chats, store] = await Promise.all([
    db.from("pending_actions").select("id", { count: "exact", head: true }).eq("status", "in_attesa"),
    db.from("chats").select("id", { count: "exact", head: true }).is("archived_at", null).or("unread_count.gt.0,needs_attention.eq.true"),
    cookies(),
  ]);
  return (
    <AppShell
      user={{ name: staff.name, role: staff.role, email: staff.email, logout }}
      counts={{ actions: actions.count ?? 0, chats: chats.count ?? 0 }}
      defaultOpen={store.get("sidebar_state")?.value !== "false"}
    >
      {children}
    </AppShell>
  );
}
