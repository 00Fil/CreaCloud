import { describe, expect, it } from "vitest";

import { accrual, familyStatement, formatEuro, tutorStatement, type BillingLesson, type Rates } from "./billing";
import { classifyCancellation, hoursBefore } from "./cancellation";
import { addDays, monthEnd, nextWeekday, romeParts, romeToInstant, weekdayOf } from "./time";

const rates: Rates = {
  defaultHourly: 2000,
  defaultGroupHourly: 1500,
  defaultTutorHourly: 1200,
  defaultTutorGroupHourly: 1500,
};

const lesson = (over: Partial<BillingLesson>): BillingLesson => ({
  id: "l",
  date: "2026-10-20",
  startMin: 17 * 60,
  endMin: 18 * 60,
  status: "svolta",
  tutorId: "t1",
  studentIds: ["s1"],
  ...over,
});

describe("time", () => {
  it("weekday starts on monday", () => {
    expect(weekdayOf("2026-10-19")).toBe(0);
    expect(weekdayOf("2026-10-25")).toBe(6);
  });
  it("converts Rome time across DST", () => {
    // 25 ottobre 2026: fine ora legale
    expect(romeToInstant("2026-10-24", 17 * 60).toISOString()).toBe("2026-10-24T15:00:00.000Z");
    expect(romeToInstant("2026-10-26", 17 * 60).toISOString()).toBe("2026-10-26T16:00:00.000Z");
    expect(romeParts(new Date("2026-10-26T16:00:00Z"))).toMatchObject({ date: "2026-10-26", minutes: 1020 });
  });
  it("date arithmetic", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(nextWeekday("2026-10-20", 1)).toBe("2026-10-20");
    expect(nextWeekday("2026-10-20", 1, true)).toBe("2026-10-27");
  });
});

describe("cancellation", () => {
  it("24h rule", () => {
    const at = new Date("2026-10-19T15:00:00Z"); // lun 17:00 a Roma
    expect(hoursBefore("2026-10-20", 17 * 60, at)).toBe(24);
    expect(classifyCancellation("2026-10-20", 17 * 60, at)).toBe("annullata_in_tempo");
    expect(classifyCancellation("2026-10-20", 16 * 60 + 30, at)).toBe("annullata_tardiva");
  });
});

describe("billing", () => {
  it("accrual by status", () => {
    expect(accrual({ status: "programmata", date: "2026-10-30" }, "2026-10-20")).toBe("prevista");
    expect(accrual({ status: "programmata", date: "2026-10-10" }, "2026-10-20")).toBe("maturata");
    expect(accrual({ status: "annullata_tardiva", date: "2026-10-30" }, "2026-10-20")).toBe("maturata");
    expect(accrual({ status: "annullata_senza_compenso", date: "2026-10-10" }, "2026-10-20")).toBe("nulla");
    expect(accrual({ status: "annullata_in_tempo", date: "2026-10-10" }, "2026-10-20")).toBe("nulla");
  });

  it("family statement with group, late cancellation and partial payment", () => {
    const lessons = [
      lesson({ id: "a", endMin: 18 * 60 + 30 }), // 1,5h individuale = 30 €
      lesson({ id: "b", studentIds: ["s1", "s2"] }), // gruppo 1h = 15 € a testa
      lesson({ id: "c", status: "annullata_tardiva", date: "2026-10-25" }), // 20 €
      lesson({ id: "d", status: "annullata_senza_compenso" }),
      lesson({ id: "e", status: "programmata", date: "2026-10-28", studentIds: ["s2"] }), // prevista 25 €
    ];
    const st = familyStatement(
      [{ id: "s1" }, { id: "s2", hourlyRateCents: 2500 }],
      lessons,
      [5000],
      rates,
      "2026-10-21",
    );
    expect(st.maturato).toBe(3000 + 1500 + 2000 + 1500);
    expect(st.previsto).toBe(2500);
    expect(st.saldo).toBe(8000 - 5000);
    expect(st.saldoStimato).toBe(10500 - 5000);
    expect(st.stato).toBe("parziale");
    expect(st.lines.find((l) => l.studentId === "s1")?.annullate).toBe(1);
  });

  it("tutor statement pays late cancellations but not 'senza compenso'", () => {
    const st = tutorStatement(
      { id: "t1", hourlyRateCents: 1200 },
      [
        lesson({ id: "a" }),
        lesson({ id: "b", status: "annullata_tardiva" }),
        lesson({ id: "c", status: "annullata_senza_compenso" }),
        lesson({ id: "d", studentIds: ["s1", "s2"], endMin: 19 * 60 }),
        lesson({ id: "x", tutorId: "t2" }),
      ],
      [2400],
      rates,
      "2026-10-30",
    );
    expect(st.maturato.minutes).toBe(240);
    expect(st.maturato.cents).toBe(1200 + 1200 + 3000);
    expect(st.lezioniAnnullateSenzaCompenso).toBe(1);
    expect(st.residuo).toBe(5400 - 2400);
  });

  it("formats euro", () => {
    expect(formatEuro(123456).replace(/\s/g, " ")).toBe("1.234,56 €");
  });
});
