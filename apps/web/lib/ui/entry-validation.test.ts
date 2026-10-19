import { describe, expect, it } from "vitest";
import {
  validateDayInput,
  validateHoursInput,
  validateModesInput,
  validatePaymentInput,
  validateRequestInput,
} from "./entry-validation";
function form(values: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values))
    for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
}
describe("explicit entry choices", () => {
  it("does not invent selected days", () =>
    expect(
      validateHoursInput(form({ start: "09:00", end: "12:00" })),
    ).not.toBeNull());
  it("accepts multiple chosen days", () =>
    expect(
      validateHoursInput(
        form({ weekday: ["0", "3"], start: "09:00", end: "12:00" }),
      ),
    ).toBeNull());
  it("rejects invalid or inverted times", () => {
    expect(
      validateHoursInput(form({ weekday: "1", start: "12:00", end: "09:00" })),
    ).not.toBeNull();
    expect(
      validateHoursInput(form({ weekday: "1", start: "", end: "19:00" })),
    ).not.toBeNull();
  });
  it("never silently turns an incomplete interval into a whole day", () =>
    expect(validateDayInput(form({ start: "09:00" }))).not.toBeNull());
  it("accepts a deliberately selected whole day", () =>
    expect(validateDayInput(form({ all_day: "on" }))).toBeNull());
  it("never silently assigns in-person teaching", () =>
    expect(validateModesInput(form({}))).not.toBeNull());
  it("accepts either or both teaching modes", () =>
    expect(
      validateModesInput(form({ modes: ["presenza", "online"] })),
    ).toBeNull());
  it("requires an explicit duration-flexibility choice", () =>
    expect(
      validateRequestInput(
        form({
          student_ids: "s",
          subject_id: "m",
          sessions_per_week: "1",
          duration_min: "60",
          mode: "online",
        }),
      ),
    ).not.toBeNull());
  it("accepts exact-duration requests", () =>
    expect(
      validateRequestInput(
        form({
          student_ids: "s",
          subject_id: "m",
          sessions_per_week: "1",
          duration_min: "60",
          mode: "online",
          flexible_duration: "off",
        }),
      ),
    ).toBeNull());
  it.each(["0", "-1", "1.001", "", "abc"])(
    "rejects invalid payment %s",
    (amount) => expect(validatePaymentInput(form({ amount }))).not.toBeNull(),
  );
  it("accepts comma decimal amounts", () =>
    expect(validatePaymentInput(form({ amount: "25,50" }))).toBeNull());
});
