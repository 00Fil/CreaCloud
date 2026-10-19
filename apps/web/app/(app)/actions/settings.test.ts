import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, db, query, audit } = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ["upsert", "insert", "update", "delete", "eq"])
    query[name] = vi.fn();
  const from = vi.fn(() => query);
  return { from, db: { from }, query, audit: vi.fn() };
});
vi.mock("@/lib/auth/staff", () => ({
  requireStaff: vi.fn(async () => ({ userId: "staff" })),
}));
vi.mock("@/lib/db/clients", () => ({ sessionClient: vi.fn(async () => db) }));
vi.mock("@/lib/db/actions", () => ({ audit }));
vi.mock("@/lib/whatsapp/waxum", () => ({
  WaxumChannel: vi.fn(),
  waxumConfigFromEnv: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import {
  addCenterHours,
  addClosure,
  addRoom,
  addSubject,
  removeSetting,
  saveGeneral,
} from "./settings";
const fd = (values: Record<string, string>) => {
  const form = new FormData();
  Object.entries(values).forEach(([k, v]) => form.set(k, v));
  return form;
};
beforeEach(() => {
  vi.clearAllMocks();
  for (const name of ["upsert", "insert", "eq"])
    query[name].mockResolvedValue({ data: null, error: null });
  query.delete.mockReturnValue(query);
  query.update.mockReturnValue(query);
});
describe("settings feedback integrity", () => {
  it("rejects invalid rates before writing any setting", async () => {
    await expect(
      saveGeneral(
        fd({
          cancellation_hours: "24",
          ai_monthly_budget_eur: "20",
          default_hourly_rate_cents: "-10",
        }),
      ),
    ).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
  it("saves valid comma-decimal rates", async () => {
    await saveGeneral(
      fd({
        cancellation_hours: "24",
        ai_monthly_budget_eur: "20,50",
        default_hourly_rate_cents: "15,50",
        default_group_hourly_rate_cents: "10",
        default_tutor_hourly_rate_cents: "12",
        default_tutor_group_hourly_rate_cents: "8",
      }),
    );
    expect(query.upsert).toHaveBeenCalledTimes(7);
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "default_hourly_rate_cents",
        value: 1550,
      }),
    );
  });
  it("rejects an inverted time range", async () => {
    await expect(
      addCenterHours(fd({ weekday: "1", start: "19:00", end: "14:00" })),
    ).rejects.toThrow();
    expect(query.insert).not.toHaveBeenCalled();
  });
  it("rejects a closure longer than 120 days without truncating it", async () => {
    await expect(
      addClosure(fd({ from: "2026-01-01", to: "2026-12-31" })),
    ).rejects.toThrow();
    expect(query.upsert).not.toHaveBeenCalled();
  });
  it("rejects fractional room capacities", async () => {
    await expect(
      addRoom(fd({ name: "Aula 1", capacity: "1.5" })),
    ).rejects.toThrow();
  });
  it("propagates database errors instead of reporting success", async () => {
    query.insert.mockResolvedValue({
      data: null,
      error: { message: "offline" },
    });
    await expect(addSubject(fd({ name: "Matematica" }))).rejects.toThrow(
      "offline",
    );
  });
  it("does not ignore a failed deletion of a used subject", async () => {
    query.eq.mockResolvedValue({
      data: null,
      error: { message: "foreign key" },
    });
    await expect(
      removeSetting(fd({ table: "subjects", id: "used" })),
    ).rejects.toThrow("foreign key");
  });
});
