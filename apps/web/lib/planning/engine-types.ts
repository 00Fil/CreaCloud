/** Contratto JSON con il motore Python (services/engine/engine/models.py). */

export interface TimeWindow {
  weekday: number;
  start: number;
  end: number;
}

export interface DatedWindow {
  date: string;
  start: number;
  end: number;
}

export interface EngineConstraint {
  id: string;
  priority: number;
  label: string;
  weekly?: TimeWindow | null;
  dated?: DatedWindow | null;
  valid_from?: string | null;
  valid_to?: string | null;
}

export interface EngineRequest {
  id: string;
  student_ids: string[];
  subject_id: string;
  kind: "ricorrente" | "singola";
  sessions_per_week: number;
  duration: number;
  flexible_duration: boolean;
  mode: "presenza" | "online" | "indifferente";
  tutor_ids: string[];
  preferred_tutor_id: string | null;
  priority: number;
  level: string | null;
  topic: string | null;
  window_from: string | null;
  window_to: string | null;
  existing: { weekday: number; start: number; tutor_id: string; duration: number; locked: boolean }[];
}

export interface EngineProblem {
  period_start: string;
  period_end: string;
  center: { hours: TimeWindow[]; closed_dates: string[]; slot_minutes: number };
  rooms: { id: string; name: string; capacity: number }[];
  tutors: {
    id: string;
    name: string;
    subjects: string[];
    modes: ("presenza" | "online")[];
    availability: TimeWindow[];
    unavailable: DatedWindow[];
    max_weekly_minutes: number | null;
    max_daily_minutes: number | null;
  }[];
  students: { id: string; name: string; constraints: EngineConstraint[]; max_lessons_per_day: number | null }[];
  requests: EngineRequest[];
  weights?: Record<string, unknown>;
  time_limit_s?: number;
}

export interface Violation {
  constraint_id: string;
  student_id: string;
  priority: number;
  label: string;
}

export interface Occurrence {
  request_id: string;
  session_index: number;
  date: string;
  start: number;
  end: number;
  tutor_id: string;
  student_ids: string[];
  subject_id: string;
  mode: "presenza" | "online";
  room_id: string | null;
  duration_changed: boolean;
  requested_duration: number;
  relocated: boolean;
  moved_from_existing: boolean;
  violations: Violation[];
}

export interface Unplaced {
  request_id: string;
  session_index: number | null;
  date: string | null;
  student_ids: string[];
  subject_id: string;
  reasons: string[];
  suggestions: string[];
}

export interface GroupSuggestion {
  request_ids: string[];
  student_ids: string[];
  subject_id: string;
  level: string | null;
  topic: string | null;
  tutor_ids: string[];
  common_slots: number;
  note: string;
}

export interface EngineSolution {
  status: string;
  occurrences: Occurrence[];
  unplaced: Unplaced[];
  group_suggestions: GroupSuggestion[];
  objective: number | null;
  solve_seconds: number;
  stats: Record<string, number>;
}
