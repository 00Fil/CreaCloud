import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildProblem, currentPattern, weekKey, type PlanningData } from "./problem";

const base = (): PlanningData => ({
  centerHours: [{ weekday: 0, start_min: 900, end_min: 1200 }],
  closures: [{ date: "2026-11-02" }],
  rooms: [{ id: "r1", name: "Aula 1", capacity: 1, active: true }, { id: "r2", name: "Vecchia", capacity: 3, active: false }],
  tutors: [
    { id: "t1", first_name: "Marco", last_name: "Rossi", modes: ["presenza"], max_weekly_minutes: null, max_daily_minutes: null, active: true },
    { id: "t2", first_name: "Gaia", last_name: "Neri", modes: ["presenza", "online"], max_weekly_minutes: 600, max_daily_minutes: null, active: true },
  ],
  tutorSubjects: [
    { tutor_id: "t1", subject_id: "mat", levels: [] },
    { tutor_id: "t2", subject_id: "mat", levels: ["liceo"] },
  ],
  availability: [{ tutor_id: "t1", weekday: 0, start_min: 900, end_min: 1200 }],
  absences: [],
  students: [{ id: "s1", first_name: "Luca", last_name: "B", school_level: "media", max_lessons_per_day: null, active: true }],
  constraints: [
    { id: "c1", student_id: "s1", priority: 2, label: "calcio", weekday: 0, date: null, start_min: 900, end_min: 960, valid_from: null, valid_to: null },
  ],
  requests: [
    {
      id: "q1",
      kind: "ricorrente",
      subject_id: "mat",
      sessions_per_week: 1,
      duration_min: 60,
      flexible_duration: true,
      mode: "presenza",
      preferred_tutor_id: null,
      priority: 2,
      topic: null,
      window_from: null,
      window_to: null,
      valid_from: "2026-09-01",
      valid_to: null,
      status: "attiva",
    },
  ],
  requestStudents: [{ request_id: "q1", student_id: "s1" }],
  lessons: [
    { id: "l1", request_id: "q1", session_index: 0, date: "2026-11-09", start_min: 1020, end_min: 1080, tutor_id: "t1", locked: false, status: "programmata", student_ids: ["s1"] },
    { id: "l2", request_id: "q1", session_index: 0, date: "2026-11-16", start_min: 1020, end_min: 1080, tutor_id: "t1", locked: false, status: "programmata", student_ids: ["s1"] },
    { id: "l3", request_id: null, session_index: 0, date: "2026-11-23", start_min: 960, end_min: 1020, tutor_id: "t1", locked: false, status: "programmata", student_ids: ["s1"] },
  ],
});

describe("buildProblem", () => {
  it("mappa i dati e filtra tutor per livello", () => {
    const p = buildProblem(base(), "2026-11-01", "2026-10-20");
    expect(p.period_start).toBe("2026-11-01");
    expect(p.period_end).toBe("2026-11-30");
    expect(p.rooms).toHaveLength(1);
    expect(p.requests[0].tutor_ids).toEqual(["t1"]); // t2 insegna solo al liceo
    expect(p.requests[0].existing).toEqual([{ weekday: 0, start: 1020, tutor_id: "t1", duration: 60, locked: false }]);
    // la lezione fissata a mano diventa un impegno rigido
    expect(p.students[0].constraints.map((c) => c.id)).toEqual(["c1", "fissa-l3"]);
    expect(p.tutors[0].unavailable).toEqual([{ date: "2026-11-23", start: 960, end: 1020 }]);
  });

  it("parte da oggi se il mese è già iniziato", () => {
    expect(buildProblem(base(), "2026-11-01", "2026-11-12").period_start).toBe("2026-11-12");
  });

  it("pattern prevalente", () => {
    expect(currentPattern(base().lessons, "q1", 2)).toHaveLength(1);
  });

  it("settimana ISO", () => {
    expect(weekKey("2026-11-09")).toBe("2026-W46");
    expect(weekKey("2026-01-01")).toBe("2026-W01");
    expect(weekKey("2027-01-01")).toBe("2026-W53");
  });

  const enginePath = resolve(__dirname, "../../../../services/engine");
  it.skipIf(!existsSync(enginePath))("è accettato e risolto dal motore Python", () => {
    const problem = buildProblem(base(), "2026-11-01", "2026-10-20", 5);
    const script = [
      "import sys, json",
      "sys.path.insert(0, sys.argv[1])",
      "from engine import Problem, solve",
      "p = Problem.model_validate_json(sys.stdin.read())",
      "s = solve(p)",
      "print(json.dumps({'n': len(s.occurrences), 'unplaced': len(s.unplaced)}))",
    ].join("\n");
    let out: string;
    try {
      out = execFileSync("python3", ["-I", "-c", script, enginePath], {
        input: JSON.stringify(problem),
        encoding: "utf8",
      });
    } catch (e) {
      if (String(e).includes("No module named")) return; // motore non installato in questo ambiente
      throw e;
    }
    const res = JSON.parse(out);
    // lunedì di novembre 2026 dal 1: 2, 9, 16, 23, 30; il 2 è chiuso → ricollocato o non collocato
    expect(res.n + res.unplaced).toBeGreaterThanOrEqual(4);
  });
});
