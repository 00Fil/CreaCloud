"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/staff";
import { audit } from "@/lib/db/actions";
import { must } from "@/lib/db/util";
import { sessionClient } from "@/lib/db/clients";
import { parseHhmm } from "@/lib/domain/time";
import { WaxumChannel, waxumConfigFromEnv } from "@/lib/whatsapp/waxum";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const euroCents = (v: string) => Math.round(Number(v.replace(",", ".")) * 100);

async function ctx() {
  const staff = await requireStaff();
  return { staff, db: await sessionClient() };
}

async function put(key: string, value: unknown) {
  const { db, staff } = await ctx();
  const res = await db
    .from("settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (res.error) throw new Error(res.error.message);
  await audit(db, staff.userId, "impostazione", "settings", null, {
    key,
    value,
  });
}

export async function saveGeneral(fd: FormData) {
  const hoursRaw = str(fd, "cancellation_hours");
  const budgetRaw = str(fd, "ai_monthly_budget_eur");
  const hours = Number(hoursRaw);
  const budget = Number(budgetRaw.replace(",", "."));
  const keys = [
    "default_hourly_rate_cents",
    "default_group_hourly_rate_cents",
    "default_tutor_hourly_rate_cents",
    "default_tutor_group_hourly_rate_cents",
  ];
  const rates = keys.map((key) => ({
    key,
    raw: str(fd, key),
    value: euroCents(str(fd, key)),
  }));
  if (
    !hoursRaw ||
    !budgetRaw ||
    !Number.isFinite(hours) ||
    hours < 0 ||
    !Number.isFinite(budget) ||
    budget < 0 ||
    rates.some((r) => !r.raw || !Number.isFinite(r.value) || r.value < 0)
  ) {
    throw new Error(
      "Inserisci importi e preavvisi validi, maggiori o uguali a zero.",
    );
  }
  await put("cancellation_hours", hours);
  await put("ai_monthly_budget_eur", budget);
  await put("ai_enabled", fd.get("ai_enabled") === "on");
  for (const { key, value } of rates) await put(key, value);
  revalidatePath("/impostazioni");
}

export async function waxumConnect() {
  await requireStaff();
  const cfg = waxumConfigFromEnv();
  if (!cfg) throw new Error("Waxum non configurato");
  await new WaxumChannel(cfg).connect();
  revalidatePath("/impostazioni");
}

export async function waxumLogout() {
  await requireStaff();
  const cfg = waxumConfigFromEnv();
  if (!cfg) throw new Error("Waxum non configurato");
  await new WaxumChannel(cfg).logout();
  revalidatePath("/impostazioni");
}

export async function addCenterHours(fd: FormData) {
  const { db } = await ctx();
  const days = fd.getAll("weekday").map(Number);
  const start = parseHhmm(str(fd, "start"));
  const end = parseHhmm(str(fd, "end"));
  if (
    start === null ||
    end === null ||
    end <= start ||
    !days.length ||
    days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  )
    throw new Error("Seleziona almeno un giorno e una fascia oraria valida.");
  must(
    await db
      .from("center_hours")
      .insert(
        days.map((weekday) => ({ weekday, start_min: start, end_min: end })),
      ),
    "Aggiornamento impostazioni",
  );
  revalidatePath("/impostazioni");
}

export async function addClosure(fd: FormData) {
  const { db } = await ctx();
  const from = str(fd, "from");
  const to = str(fd, "to") || from;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
    !Number.isFinite(Date.parse(from)) ||
    !Number.isFinite(Date.parse(to)) ||
    to < from ||
    (Date.parse(to) - Date.parse(from)) / 86400000 >= 120
  )
    throw new Error("Scegli un intervallo valido di massimo 120 giorni.");
  const rows: { date: string; note: string }[] = [];
  for (
    let d = new Date(`${from}T12:00:00Z`);
    d <= new Date(`${to}T12:00:00Z`) && rows.length < 120;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    rows.push({ date: d.toISOString().slice(0, 10), note: str(fd, "note") });
  }
  must(
    await db.from("center_closures").upsert(rows),
    "Aggiornamento impostazioni",
  );
  revalidatePath("/impostazioni");
}

export async function addRoom(fd: FormData) {
  const { db } = await ctx();
  if (!str(fd, "name")) throw new Error("Inserisci un nome.");
  const capacity = Number(str(fd, "capacity") || 1);
  if (!Number.isInteger(capacity) || capacity < 1)
    throw new Error("Inserisci un numero intero di posti, almeno uno.");
  must(
    await db.from("rooms").insert({ name: str(fd, "name"), capacity }),
    "Aggiunta postazione",
  );
  revalidatePath("/impostazioni");
}

export async function toggleRoom(fd: FormData) {
  const { db } = await ctx();
  must(
    await db
      .from("rooms")
      .update({ active: str(fd, "active") === "1" })
      .eq("id", str(fd, "id")),
    "Aggiornamento impostazioni",
  );
  revalidatePath("/impostazioni");
}

export async function addSubject(fd: FormData) {
  const { db } = await ctx();
  if (!str(fd, "name")) throw new Error("Inserisci un nome.");
  must(
    await db.from("subjects").insert({ name: str(fd, "name") }),
    "Aggiornamento impostazioni",
  );
  revalidatePath("/impostazioni");
}

/** Rimuove righe di configurazione; le materie già usate da lezioni o richieste non si possono eliminare. */
export async function removeSetting(fd: FormData) {
  const { db } = await ctx();
  const table = str(fd, "table");
  const id = str(fd, "id");
  if (table === "center_hours" || table === "subjects")
    must(await db.from(table).delete().eq("id", id), "Rimozione impostazione");
  if (table === "center_closures")
    must(
      await db.from(table).delete().eq("date", id),
      "Rimozione impostazione",
    );
  revalidatePath("/impostazioni");
}
