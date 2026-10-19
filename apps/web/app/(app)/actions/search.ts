"use server";

import { requireStaff } from "@/lib/auth/staff";
import { sessionClient } from "@/lib/db/clients";

export type SearchItem = { id: string; kind: "famiglia" | "studente" | "genitore" | "tutor" | "chat"; label: string; sub: string; href: string };

/** Indice per la ricerca rapida (Ctrl+K): persone e chat. Caricato solo quando si apre la ricerca. */
export async function searchIndex(): Promise<SearchItem[]> {
  await requireStaff();
  const db = await sessionClient();
  const [families, parents, students, tutors, chats] = await Promise.all([
    db.from("families").select("id, name").eq("active", true),
    db.from("parents").select("id, family_id, first_name, last_name, phone"),
    db.from("students").select("id, family_id, first_name, last_name, school_level").eq("active", true),
    db.from("tutors").select("id, first_name, last_name, phone, active"),
    db.from("chats").select("id, display_name, phone").order("last_message_at", { ascending: false, nullsFirst: false }).limit(300),
  ]);
  const famName = new Map((families.data ?? []).map((f) => [f.id, f.name as string]));
  return [
    ...(families.data ?? []).map((f) => ({ id: f.id, kind: "famiglia" as const, label: f.name, sub: "Famiglia", href: `/persone/famiglia/${f.id}` })),
    ...(students.data ?? []).map((s) => ({
      id: s.id,
      kind: "studente" as const,
      label: `${s.first_name} ${s.last_name}`.trim(),
      sub: [s.school_level, famName.get(s.family_id)].filter(Boolean).join(" · "),
      href: `/persone/famiglia/${s.family_id}`,
    })),
    ...(parents.data ?? []).map((p) => ({
      id: p.id,
      kind: "genitore" as const,
      label: `${p.first_name} ${p.last_name}`.trim(),
      sub: ["Genitore", famName.get(p.family_id), p.phone].filter(Boolean).join(" · "),
      href: `/persone/famiglia/${p.family_id}`,
    })),
    ...(tutors.data ?? []).map((t) => ({
      id: t.id,
      kind: "tutor" as const,
      label: `${t.first_name} ${t.last_name}`.trim(),
      sub: t.active ? "Tutor" : "Tutor non attivo",
      href: `/persone/tutor/${t.id}`,
    })),
    ...(chats.data ?? []).map((c) => ({ id: c.id, kind: "chat" as const, label: c.display_name || c.phone, sub: `Chat · ${c.phone}`, href: `/chat/${c.id}` })),
  ];
}
