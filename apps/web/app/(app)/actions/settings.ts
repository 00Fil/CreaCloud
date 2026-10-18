"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/staff";
import { audit } from "@/lib/db/actions";
import { sessionClient } from "@/lib/db/clients";
import { parseHhmm } from "@/lib/domain/time";
import { GatewayChannel, gatewayConfigFromEnv } from "@/lib/whatsapp/gateway";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const euroCents = (v: string) => Math.round(Number(v.replace(",", ".")) * 100);

async function ctx() {
  const staff = await requireStaff();
  return { staff, db: await sessionClient() };
}

async function put(key: string, value: unknown) {
  const { db, staff } = await ctx();
  const res = await db.from("settings").upsert({ key, value, updated_at: new Date().toISOString() });
  if (res.error) throw new Error(res.error.message);
  await audit(db, staff.userId, "impostazione", "settings", null, { key, value });
}

export async function setProvider(fd: FormData) {
  const provider = str(fd, "provider");
  if (provider !== "baileys" && provider !== "cloud") return;
  await put("whatsapp_provider", provider);
  revalidatePath("/impostazioni");
}

export async function saveGeneral(fd: FormData) {
  const hours = Number(str(fd, "cancellation_hours"));
  if (Number.isFinite(hours) && hours >= 0) await put("cancellation_hours", hours);
  const budget = Number(str(fd, "ai_monthly_budget_eur").replace(",", "."));
  if (Number.isFinite(budget) && budget >= 0) await put("ai_monthly_budget_eur", budget);
  await put("ai_enabled", fd.get("ai_enabled") === "on");
  for (const key of ["default_hourly_rate_cents", "default_group_hourly_rate_cents", "default_tutor_hourly_rate_cents", "default_tutor_group_hourly_rate_cents"]) {
    const v = str(fd, key);
    if (v && Number.isFinite(euroCents(v))) await put(key, euroCents(v));
  }
  revalidatePath("/impostazioni");
}

export async function gatewayLogout() {
  await requireStaff();
  const cfg = gatewayConfigFromEnv();
  if (cfg) await new GatewayChannel(cfg).logout().catch(() => undefined);
  revalidatePath("/impostazioni");
}

export async function addCenterHours(fd: FormData) {
  const { db } = await ctx();
  const days = fd.getAll("weekday").map(Number);
  const start = parseHhmm(str(fd, "start"));
  const end = parseHhmm(str(fd, "end"));
  if (start === null || end === null || end <= start || !days.length) return;
  await db.from("center_hours").insert(days.map((weekday) => ({ weekday, start_min: start, end_min: end })));
  revalidatePath("/impostazioni");
}

export async function addClosure(fd: FormData) {
  const { db } = await ctx();
  const from = str(fd, "from");
  const to = str(fd, "to") || from;
  if (!from) return;
  const rows: { date: string; note: string }[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`) && rows.length < 120; d.setUTCDate(d.getUTCDate() + 1)) {
    rows.push({ date: d.toISOString().slice(0, 10), note: str(fd, "note") });
  }
  await db.from("center_closures").upsert(rows);
  revalidatePath("/impostazioni");
}

export async function addRoom(fd: FormData) {
  const { db } = await ctx();
  if (!str(fd, "name")) return;
  await db.from("rooms").insert({ name: str(fd, "name"), capacity: Math.max(1, Number(str(fd, "capacity")) || 1) });
  revalidatePath("/impostazioni");
}

export async function toggleRoom(fd: FormData) {
  const { db } = await ctx();
  await db.from("rooms").update({ active: str(fd, "active") === "1" }).eq("id", str(fd, "id"));
  revalidatePath("/impostazioni");
}

export async function addSubject(fd: FormData) {
  const { db } = await ctx();
  if (!str(fd, "name")) return;
  await db.from("subjects").insert({ name: str(fd, "name") });
  revalidatePath("/impostazioni");
}

/** Rimuove righe di configurazione; le materie già usate da lezioni o richieste non si possono eliminare. */
export async function removeSetting(fd: FormData) {
  const { db } = await ctx();
  const table = str(fd, "table");
  const id = str(fd, "id");
  if (table === "center_hours" || table === "subjects") await db.from(table).delete().eq("id", id);
  if (table === "center_closures") await db.from(table).delete().eq("date", id);
  revalidatePath("/impostazioni");
}
