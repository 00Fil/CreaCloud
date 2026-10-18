"""Pre-calcoli condivisi da solver, diagnostica e suggerimenti di gruppo."""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Iterable, Optional

from .models import (
    Constraint,
    LessonRequest,
    Mode,
    Problem,
    RequestKind,
    Student,
    TimeWindow,
    Tutor,
)

WEEKDAYS_IT = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"]


def hhmm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def overlaps(a0: int, a1: int, b0: int, b1: int) -> bool:
    return a0 < b1 and b0 < a1


def merge_windows(windows: Iterable[tuple[int, int]]) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    for s, e in sorted(windows):
        if out and s <= out[-1][1]:
            out[-1] = (out[-1][0], max(out[-1][1], e))
        else:
            out.append((s, e))
    return out


def by_weekday(windows: Iterable[TimeWindow]) -> dict[int, list[tuple[int, int]]]:
    grouped: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for w in windows:
        grouped[w.weekday].append((w.start, w.end))
    return {d: merge_windows(ws) for d, ws in grouped.items()}


def covered(merged: list[tuple[int, int]], start: int, end: int) -> bool:
    return any(s <= start and end <= e for s, e in merged)


@dataclass(frozen=True)
class StudentRule:
    """Vincolo di uno studente proiettato sulle date del periodo."""

    constraint: Constraint
    student_id: str
    start: int
    end: int
    weekday: int
    dates: frozenset[date]


@dataclass
class Candidate:
    """Una possibile collocazione (settimanale se `date` è None)."""

    weekday: int
    start: int
    duration: int
    tutor_id: str
    mode: Mode
    cost: int = 0
    date: Optional[date] = None
    # vincoli soft violati: constraint_id -> date coinvolte
    soft: dict[str, set[date]] = field(default_factory=dict)
    # date della settimana-tipo che richiedono una ricollocazione
    hard_dates: set[date] = field(default_factory=set)

    @property
    def end(self) -> int:
        return self.start + self.duration


class Context:
    def __init__(self, problem: Problem):
        self.p = problem
        self.w = problem.weights
        self.slot = problem.center.slot_minutes
        self.tutors: dict[str, Tutor] = {t.id: t for t in problem.tutors}
        self.students: dict[str, Student] = {s.id: s for s in problem.students}
        self.closed = set(problem.center.closed_dates)
        self.center_hours = by_weekday(problem.center.hours)
        self.tutor_hours = {t.id: by_weekday(t.availability) for t in problem.tutors}
        self.hard_priorities = set(self.w.hard_priorities)

        self.all_dates: list[date] = []
        d = problem.period_start
        while d <= problem.period_end:
            self.all_dates.append(d)
            d += timedelta(days=1)
        self.dates_by_weekday: dict[int, list[date]] = defaultdict(list)
        for d in self.all_dates:
            self.dates_by_weekday[d.weekday()].append(d)

        self.rules: dict[str, list[StudentRule]] = defaultdict(list)
        for s in problem.students:
            for c in s.constraints:
                rule = self._project(s.id, c)
                if rule is not None:
                    self.rules[s.id].append(rule)

        self.tutor_off: dict[str, dict[date, list[tuple[int, int]]]] = {}
        for t in problem.tutors:
            off: dict[date, list[tuple[int, int]]] = defaultdict(list)
            for u in t.unavailable:
                off[u.date].append((u.start, u.end))
            self.tutor_off[t.id] = off

        self.room_caps = sorted((r.capacity for r in problem.rooms), reverse=True)
        self.max_room_capacity = self.room_caps[0] if self.room_caps else math.inf

    # ------------------------------------------------------------- vincoli

    def _project(self, student_id: str, c: Constraint) -> Optional[StudentRule]:
        lo = max(self.p.period_start, c.valid_from or self.p.period_start)
        hi = min(self.p.period_end, c.valid_to or self.p.period_end)
        if c.weekly is not None:
            dates = frozenset(
                d for d in self.dates_by_weekday.get(c.weekly.weekday, []) if lo <= d <= hi
            )
            if not dates:
                return None
            return StudentRule(c, student_id, c.weekly.start, c.weekly.end, c.weekly.weekday, dates)
        assert c.dated is not None
        if not (lo <= c.dated.date <= hi):
            return None
        return StudentRule(
            c, student_id, c.dated.start, c.dated.end, c.dated.date.weekday(), frozenset([c.dated.date])
        )

    def is_hard(self, priority: int) -> bool:
        return priority in self.hard_priorities

    # ------------------------------------------------------------- utilità

    def cells(self, start: int, end: int) -> range:
        return range(start // self.slot, math.ceil(end / self.slot))

    def durations(self, req: LessonRequest) -> list[int]:
        if not req.flexible_duration:
            return [req.duration]
        lo, hi = self.p.duration_bounds
        out = [req.duration]
        for delta in (-30, 30):
            d = req.duration + delta
            if lo <= d <= hi:
                out.append(d)
        return out

    def qualified_tutors(self, req: LessonRequest) -> list[Tutor]:
        if req.tutor_ids:
            return [self.tutors[t] for t in req.tutor_ids if t in self.tutors]
        return [t for t in self.p.tutors if req.subject_id in t.subjects]

    def modes(self, req: LessonRequest, tutor: Tutor) -> list[Mode]:
        wanted: list[Mode] = ["presenza", "online"] if req.mode == "indifferente" else [req.mode]
        out = [m for m in wanted if m in tutor.modes]
        if "presenza" in out and len(req.student_ids) > self.max_room_capacity:
            out.remove("presenza")
        return out

    def starts(self, weekday: int, duration: int) -> Iterable[int]:
        for s, e in self.center_hours.get(weekday, []):
            first = math.ceil(s / self.slot) * self.slot
            for start in range(first, e - duration + 1, self.slot):
                yield start

    def tutor_off_on(self, tutor_id: str, d: date, start: int, end: int) -> bool:
        return any(overlaps(start, end, s, e) for s, e in self.tutor_off[tutor_id].get(d, []))

    def base_cost(self, req: LessonRequest, duration: int, tutor_id: str, mode: Mode) -> int:
        cost = 0
        if duration != req.duration:
            cost += self.w.duration_change_per_30 * abs(duration - req.duration) // 30
        if req.preferred_tutor_id and tutor_id != req.preferred_tutor_id:
            cost += self.w.not_preferred_tutor
        if req.mode == "indifferente" and mode == "online":
            cost += self.w.online_when_indifferent
        return cost

    # ------------------------------------------------------ candidati

    def weekly_candidates(self, req: LessonRequest) -> list[Candidate]:
        """Collocazioni settimanali rispettose dei vincoli rigidi.

        I conflitti rigidi che toccano solo alcune date (festività, assenze,
        impegni P1 di un solo giorno) non escludono l'opzione: la rendono più
        costosa e verranno risolti ricollocando quella singola lezione.
        """
        out: list[Candidate] = []
        for weekday in range(7):
            week_dates = self.dates_by_weekday.get(weekday, [])
            if not week_dates:
                continue
            n_dates = len(week_dates)
            for duration in self.durations(req):
                for start in self.starts(weekday, duration):
                    end = start + duration
                    soft, hard_dates, blocked = self._student_effects(req, weekday, start, end, week_dates)
                    if blocked:
                        continue
                    hard_dates |= {d for d in week_dates if d in self.closed}
                    for tutor in self.qualified_tutors(req):
                        if not covered(self.tutor_hours[tutor.id].get(weekday, []), start, end):
                            continue
                        t_hard = {d for d in week_dates if self.tutor_off_on(tutor.id, d, start, end)}
                        all_hard = hard_dates | t_hard
                        if len(all_hard) >= n_dates:
                            continue
                        for mode in self.modes(req, tutor):
                            cost = self.base_cost(req, duration, tutor.id, mode)
                            for cid, ds in soft.items():
                                cost += round(self._violation_weight(req, cid) * len(ds) / n_dates)
                            cost += self.w.partial_hard_conflict_per_date * len(all_hard)
                            out.append(
                                Candidate(weekday, start, duration, tutor.id, mode, cost, None, soft, set(all_hard))
                            )
        return out

    def dated_candidates(
        self,
        req: LessonRequest,
        dates: Iterable[date],
        reference_tutor: Optional[str] = None,
    ) -> list[Candidate]:
        """Collocazioni in date precise (ricollocazioni e richieste singole)."""
        out: list[Candidate] = []
        for d in dates:
            if d in self.closed or d < self.p.period_start or d > self.p.period_end:
                continue
            weekday = d.weekday()
            for duration in self.durations(req):
                for start in self.starts(weekday, duration):
                    end = start + duration
                    soft, hard_dates, blocked = self._student_effects(req, weekday, start, end, [d])
                    if blocked or hard_dates:
                        continue
                    for tutor in self.qualified_tutors(req):
                        if not covered(self.tutor_hours[tutor.id].get(weekday, []), start, end):
                            continue
                        if self.tutor_off_on(tutor.id, d, start, end):
                            continue
                        for mode in self.modes(req, tutor):
                            cost = self.base_cost(req, duration, tutor.id, mode)
                            if reference_tutor and tutor.id != reference_tutor:
                                cost += self.w.not_preferred_tutor
                            for cid in soft:
                                cost += self._violation_weight(req, cid)
                            out.append(Candidate(weekday, start, duration, tutor.id, mode, cost, d, soft, set()))
        return out

    def _student_effects(
        self, req: LessonRequest, weekday: int, start: int, end: int, dates: list[date]
    ) -> tuple[dict[str, set[date]], set[date], bool]:
        """Restituisce (vincoli soft toccati, date con conflitto rigido, bloccato)."""
        soft: dict[str, set[date]] = {}
        hard: set[date] = set()
        date_set = set(dates)
        for sid in req.student_ids:
            for rule in self.rules.get(sid, []):
                if rule.weekday != weekday or not overlaps(start, end, rule.start, rule.end):
                    continue
                hit = rule.dates & date_set
                if not hit:
                    continue
                if self.is_hard(rule.constraint.priority):
                    if hit == date_set:
                        return {}, set(), True
                    hard |= hit
                else:
                    soft.setdefault(f"{sid}:{rule.constraint.id}", set()).update(hit)
        return soft, hard, False

    def _violation_weight(self, req: LessonRequest, key: str) -> int:
        sid, cid = key.split(":", 1)
        for rule in self.rules.get(sid, []):
            if rule.constraint.id == cid:
                return self.w.violation.get(rule.constraint.priority, 0)
        return 0

    def rule_by_key(self, key: str) -> Optional[StudentRule]:
        sid, cid = key.split(":", 1)
        for rule in self.rules.get(sid, []):
            if rule.constraint.id == cid:
                return rule
        return None

    def placement_reward(self, req: LessonRequest) -> int:
        return round(self.w.place * self.w.request_priority_multiplier.get(req.priority, 1.0))

    def iso_week(self, d: date) -> list[date]:
        monday = d - timedelta(days=d.weekday())
        return [monday + timedelta(days=i) for i in range(7)]

    def single_dates(self, req: LessonRequest) -> list[date]:
        lo = max(self.p.period_start, req.window_from or self.p.period_start)
        hi = min(self.p.period_end, req.window_to or self.p.period_end)
        return [d for d in self.all_dates if lo <= d <= hi]

    def recurring(self) -> list[LessonRequest]:
        return [r for r in self.p.requests if r.kind == RequestKind.ricorrente]

    def singles(self) -> list[LessonRequest]:
        return [r for r in self.p.requests if r.kind == RequestKind.singola]
