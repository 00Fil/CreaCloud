"""Motore di pianificazione mensile basato su OR-Tools CP-SAT.

Fase A: settimana-tipo. Ogni sessione ricorrente sceglie giorno, ora, durata,
tutor e modalità; la stessa collocazione si ripete tutte le settimane del mese.
Fase B: calendario reale. Le singole lezioni che cadono su un conflitto rigido
di una data precisa (festività, assenza del tutor, impegno P1 di quel giorno)
vengono ricollocate nella stessa settimana, insieme alle richieste singole.
Tutto ciò che non trova posto viene restituito con i motivi.
"""

from __future__ import annotations

import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

from ortools.sat.python import cp_model

from .context import WEEKDAYS_IT, Candidate, Context, covered, hhmm, overlaps
from .groups import suggest_groups
from .models import (
    LessonRequest,
    Occurrence,
    Problem,
    Solution,
    Unplaced,
    Violation,
)

# ------------------------------------------------------------------ occupazione


@dataclass
class Occupancy:
    """Risorse già impegnate, indicizzate per giorno (settimanale) o data."""

    slot: int
    tutor: dict[tuple, set[int]] = field(default_factory=lambda: defaultdict(set))
    student: dict[tuple, set[int]] = field(default_factory=lambda: defaultdict(set))
    rooms: dict[tuple, Counter] = field(default_factory=lambda: defaultdict(Counter))
    tutor_minutes: Counter = field(default_factory=Counter)
    tutor_day_minutes: Counter = field(default_factory=Counter)

    def add(self, key, cand: Candidate, students: list[str], cells: range) -> None:
        self.tutor[(cand.tutor_id, key)].update(cells)
        for sid in students:
            self.student[(sid, key)].update(cells)
        if cand.mode == "presenza":
            for c in cells:
                self.rooms[(key, c)][len(students)] += 1
        self.tutor_minutes[cand.tutor_id] += cand.duration
        self.tutor_day_minutes[(cand.tutor_id, key)] += cand.duration

    def rooms_used(self, key, cell: int, size: int) -> int:
        return sum(n for s, n in self.rooms[(key, cell)].items() if s >= size)


def rooms_available(ctx: Context, size: int) -> int:
    return sum(1 for c in ctx.room_caps if c >= size)


def blocking_reasons(
    ctx: Context, req: LessonRequest, cand: Candidate, key, occ: Occupancy, weekly: bool
) -> list[str]:
    """Motivi per cui un candidato non è utilizzabile con l'occupazione data."""
    reasons: list[str] = []
    cells = ctx.cells(cand.start, cand.end)
    if any(c in occ.tutor[(cand.tutor_id, key)] for c in cells):
        reasons.append("tutor_busy")
    if any(any(c in occ.student[(sid, key)] for c in cells) for sid in req.student_ids):
        reasons.append("student_busy")
    if cand.mode == "presenza" and ctx.room_caps:
        size = len(req.student_ids)
        cap = rooms_available(ctx, size)
        if any(occ.rooms_used(key, c, size) >= cap for c in cells):
            reasons.append("rooms_full")
    tutor = ctx.tutors[cand.tutor_id]
    if weekly and tutor.max_weekly_minutes is not None:
        if occ.tutor_minutes[tutor.id] + cand.duration > tutor.max_weekly_minutes:
            reasons.append("tutor_cap")
    if tutor.max_daily_minutes is not None:
        if occ.tutor_day_minutes[(tutor.id, key)] + cand.duration > tutor.max_daily_minutes:
            reasons.append("tutor_cap")
    return reasons


# ------------------------------------------------------------------ modello


@dataclass
class Item:
    """Una sessione da collocare con i suoi candidati."""

    req: LessonRequest
    index: int
    cands: list[Candidate]
    xs: list = field(default_factory=list)
    placed: Optional[cp_model.IntVar] = None
    origin_date: Optional[date] = None
    origin: Optional[Candidate] = None
    chosen: Optional[Candidate] = None


def _existing_match(cand: Candidate, ex) -> bool:
    return cand.weekday == ex.weekday and cand.start == ex.start and cand.tutor_id == ex.tutor_id


def _add_resource_constraints(
    ctx: Context,
    model: cp_model.CpModel,
    items: list[Item],
    keyfn,
    occ: Optional[Occupancy],
    weekly: bool,
) -> tuple[list, list]:
    """Vincoli di non sovrapposizione, postazioni e ore tutor.

    Restituisce termini aggiuntivi dell'obiettivo (penalità) come (coeff, var).
    """
    tutor_cell: dict[tuple, list] = defaultdict(list)
    student_cell: dict[tuple, list] = defaultdict(list)
    room_cell: dict[tuple, list] = defaultdict(list)
    tutor_minutes: dict[str, list] = defaultdict(list)
    tutor_day_minutes: dict[tuple, list] = defaultdict(list)
    tutor_day: dict[tuple, list] = defaultdict(list)
    student_day: dict[tuple, list] = defaultdict(list)
    request_day: dict[tuple, list] = defaultdict(list)

    for it in items:
        size = len(it.req.student_ids)
        for cand, x in zip(it.cands, it.xs):
            key = keyfn(cand)
            for c in ctx.cells(cand.start, cand.end):
                tutor_cell[(cand.tutor_id, key, c)].append(x)
                for sid in it.req.student_ids:
                    student_cell[(sid, key, c)].append(x)
                if cand.mode == "presenza" and ctx.room_caps:
                    room_cell[(key, c)].append((x, size))
            tutor_minutes[cand.tutor_id].append((cand.duration, x))
            tutor_day_minutes[(cand.tutor_id, key)].append((cand.duration, x))
            tutor_day[(cand.tutor_id, key)].append(x)
            for sid in it.req.student_ids:
                student_day[(sid, key)].append(x)
            request_day[(it.req.id, key)].append(x)

    for xs in list(tutor_cell.values()) + list(student_cell.values()):
        if len(xs) > 1:
            model.AddAtMostOne(xs)

    sizes = sorted({size for terms in room_cell.values() for _, size in terms})
    for (key, c), terms in room_cell.items():
        for k in sizes:
            group = [x for x, size in terms if size >= k]
            if not group:
                continue
            cap = rooms_available(ctx, k) - (occ.rooms_used(key, c, k) if occ else 0)
            if len(group) > cap:
                model.Add(sum(group) <= max(cap, 0))

    for tid, terms in tutor_minutes.items():
        limit = ctx.tutors[tid].max_weekly_minutes
        if weekly and limit is not None:
            model.Add(sum(d * x for d, x in terms) <= limit)
    for (tid, key), terms in tutor_day_minutes.items():
        limit = ctx.tutors[tid].max_daily_minutes
        if limit is not None:
            used = occ.tutor_day_minutes[(tid, key)] if occ else 0
            model.Add(sum(d * x for d, x in terms) <= max(limit - used, 0))
    for (sid, key), xs in student_day.items():
        limit = ctx.students[sid].max_lessons_per_day if sid in ctx.students else None
        if limit is not None:
            model.Add(sum(xs) <= limit)

    penalties: list = []
    if weekly and ctx.w.tutor_day:
        for (tid, key), xs in tutor_day.items():
            z = model.NewBoolVar(f"td_{tid}_{key}")
            for x in xs:
                model.AddImplication(x, z)
            penalties.append((ctx.w.tutor_day, z))
    if weekly and ctx.w.same_day_same_request:
        for (rid, key), xs in request_day.items():
            if len(xs) > 1:
                extra = model.NewIntVar(0, len(xs), f"sd_{rid}_{key}")
                model.Add(extra >= sum(xs) - 1)
                penalties.append((ctx.w.same_day_same_request, extra))
    return penalties, []


def _solve(ctx: Context, model: cp_model.CpModel, items: list[Item], penalties: list, time_limit: float):
    terms = []
    for it in items:
        if it.placed is None:
            continue
        terms.append(-ctx.placement_reward(it.req) * it.placed)
        for cand, x in zip(it.cands, it.xs):
            if cand.cost:
                terms.append(cand.cost * x)
    for coeff, var in penalties:
        terms.append(coeff * var)
    model.Minimize(sum(terms))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers = ctx.p.workers
    solver.parameters.random_seed = 7
    status = solver.Solve(model)
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for it in items:
            for cand, x in zip(it.cands, it.xs):
                if solver.Value(x):
                    it.chosen = cand
                    break
    return solver, status


def _build_items(model: cp_model.CpModel, items: list[Item], prefix: str) -> None:
    for n, it in enumerate(items):
        if not it.cands:
            continue
        it.xs = [model.NewBoolVar(f"{prefix}{n}_{i}") for i in range(len(it.cands))]
        it.placed = model.NewBoolVar(f"{prefix}p{n}")
        model.Add(sum(it.xs) == it.placed)


# ------------------------------------------------------------------ fase A


def _phase_a(ctx: Context, deadline: float) -> tuple[list[Item], str, Optional[float]]:
    model = cp_model.CpModel()
    items: list[Item] = []
    for req in ctx.recurring():
        base = ctx.weekly_candidates(req)
        for k in range(req.sessions_per_week):
            cands = list(base)
            ex = req.existing[k] if k < len(req.existing) else None
            if ex is not None:
                if ex.locked:
                    cands = [c for c in cands if _existing_match(c, ex) and c.duration == ex.duration]
                else:
                    cands = [
                        Candidate(**{**c.__dict__, "cost": c.cost + (0 if _existing_match(c, ex) else ctx.w.move_existing)})
                        for c in cands
                    ]
            items.append(Item(req, k, cands))
    _build_items(model, items, "a")

    by_req: dict[str, list[Item]] = defaultdict(list)
    for it in items:
        by_req[it.req.id].append(it)
    for rid, group in by_req.items():
        if group[0].req.existing:
            continue
        prev = None
        for it in group:
            if it.placed is None:
                prev = None
                continue
            pos = model.NewIntVar(0, 7 * 1440, f"pos_{rid}_{it.index}")
            model.Add(pos == sum((c.weekday * 1440 + c.start) * x for c, x in zip(it.cands, it.xs)))
            if prev is not None:
                prev_it, prev_pos = prev
                model.Add(pos > prev_pos).OnlyEnforceIf(it.placed)
                model.AddImplication(it.placed, prev_it.placed)
            prev = (it, pos)

    active = [it for it in items if it.placed is not None]
    penalties, _ = _add_resource_constraints(ctx, model, active, lambda c: c.weekday, None, weekly=True)
    solver, status = _solve(ctx, model, active, penalties, max(1.0, deadline - time.monotonic()))
    objective = solver.ObjectiveValue() if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else None
    return items, solver.StatusName(status), objective


# ------------------------------------------------------------------ fase B


def _phase_b(
    ctx: Context, template: list[Item], deadline: float
) -> tuple[list[tuple[Item, Candidate, date, bool]], list[Item], Occupancy]:
    occ = Occupancy(ctx.slot)
    fixed: list[tuple[Item, Candidate, date, bool]] = []
    movable: list[Item] = []
    per_req_dates: dict[str, set[date]] = defaultdict(set)

    for it in template:
        cand = it.chosen
        if cand is None:
            continue
        for d in ctx.dates_by_weekday.get(cand.weekday, []):
            if d in cand.hard_dates:
                movable.append(Item(it.req, it.index, [], origin_date=d, origin=cand))
                continue
            dated = Candidate(**{**cand.__dict__, "date": d})
            occ.add(d, dated, it.req.student_ids, ctx.cells(cand.start, cand.end))
            fixed.append((it, dated, d, False))
            per_req_dates[it.req.id].add(d)

    for req in ctx.singles():
        movable.append(Item(req, 0, []))

    for it in movable:
        if it.origin_date is not None:
            week = [d for d in ctx.iso_week(it.origin_date) if d != it.origin_date]
            cands = ctx.dated_candidates(it.req, week, reference_tutor=it.origin.tutor_id)
        else:
            cands = ctx.dated_candidates(it.req, ctx.single_dates(it.req))
        usable = []
        for c in cands:
            if blocking_reasons(ctx, it.req, c, c.date, occ, weekly=False):
                continue
            if c.date in per_req_dates[it.req.id]:
                c.cost += ctx.w.same_day_same_request
            usable.append(c)
        it.cands = usable

    if movable:
        model = cp_model.CpModel()
        _build_items(model, movable, "b")
        active = [it for it in movable if it.placed is not None]
        penalties, _ = _add_resource_constraints(ctx, model, active, lambda c: c.date, occ, weekly=False)
        _solve(ctx, model, active, penalties, max(1.0, deadline - time.monotonic()))
        for it in active:
            if it.chosen is not None:
                occ.add(it.chosen.date, it.chosen, it.req.student_ids, ctx.cells(it.chosen.start, it.chosen.end))
                fixed.append((it, it.chosen, it.chosen.date, it.origin_date is not None))
    return fixed, movable, occ


# ------------------------------------------------------------------ diagnostica

REASON_TEXT = {
    "tutor_unavailable": "il tutor non è disponibile",
    "tutor_busy": "il tutor è già occupato con altre lezioni",
    "student_busy": "lo studente ha già un'altra lezione",
    "student_hard": "c'è un impegno inderogabile dello studente",
    "rooms_full": "le postazioni sono tutte occupate",
    "tutor_cap": "il tutor ha raggiunto il limite di ore",
}

SUGGESTION_TEXT = {
    "tutor_busy": "{slot} con {tutor}: si libera spostando un'altra lezione di {tutor}",
    "tutor_unavailable": "{slot} con {tutor}: possibile se {tutor} aggiunge questa disponibilità",
    "student_hard": "{slot} con {tutor}: possibile solo derogando a «{label}»",
    "rooms_full": "{slot} con {tutor}: possibile online o liberando una postazione",
    "student_busy": "{slot} con {tutor}: lo studente ha un'altra lezione da spostare",
    "tutor_cap": "{slot} con {tutor}: possibile alzando il limite ore di {tutor}",
}


def _explain_weekly(ctx: Context, req: LessonRequest, occ: Occupancy) -> tuple[list[str], list[str]]:
    tutors = ctx.qualified_tutors(req)
    if not tutors:
        return ["Nessun tutor abilitato per questa materia."], []
    counts: Counter = Counter()
    singles: list[tuple[str, str, str]] = []
    for weekday in range(7):
        week_dates = ctx.dates_by_weekday.get(weekday, [])
        if not week_dates:
            continue
        for start in ctx.starts(weekday, req.duration):
            end = start + req.duration
            _, _, blocked = ctx._student_effects(req, weekday, start, end, week_dates)
            hard_label = ""
            if blocked:
                for sid in req.student_ids:
                    for rule in ctx.rules.get(sid, []):
                        if (
                            rule.weekday == weekday
                            and ctx.is_hard(rule.constraint.priority)
                            and overlaps(start, end, rule.start, rule.end)
                        ):
                            hard_label = rule.constraint.label or "impegno"
            for tutor in tutors:
                modes = ctx.modes(req, tutor) or ["online"]
                cand = Candidate(weekday, start, req.duration, tutor.id, modes[0])
                reasons = []
                if blocked:
                    reasons.append("student_hard")
                if not covered(ctx.tutor_hours[tutor.id].get(weekday, []), start, end):
                    reasons.append("tutor_unavailable")
                reasons += blocking_reasons(ctx, req, cand, weekday, occ, weekly=True)
                for r in set(reasons):
                    counts[r] += 1
                if len(set(reasons)) == 1:
                    slot = f"{WEEKDAYS_IT[weekday]} {hhmm(start)}–{hhmm(end)}"
                    singles.append((reasons[0], slot, tutor.name or tutor.id, hard_label))
    reasons = [
        f"In {n} combinazioni giorno/ora/tutor {REASON_TEXT[r]}." for r, n in counts.most_common(3)
    ] or ["Nessuna fascia compatibile con gli orari del centro."]
    order = ["tutor_busy", "rooms_full", "tutor_unavailable", "student_busy", "tutor_cap", "student_hard"]
    singles.sort(key=lambda s: order.index(s[0]))
    suggestions, seen = [], set()
    for reason, slot, tutor, label in singles:
        if slot in seen:
            continue
        seen.add(slot)
        suggestions.append(SUGGESTION_TEXT[reason].format(slot=slot, tutor=tutor, label=label))
        if len(suggestions) == 3:
            break
    return reasons, suggestions


def _conflict_reason(ctx: Context, req: LessonRequest, cand: Candidate, d: date) -> str:
    if d in ctx.closed:
        return "il centro è chiuso"
    if ctx.tutor_off_on(cand.tutor_id, d, cand.start, cand.end):
        return f"{ctx.tutors[cand.tutor_id].name or cand.tutor_id} è assente"
    for sid in req.student_ids:
        for rule in ctx.rules.get(sid, []):
            if d in rule.dates and ctx.is_hard(rule.constraint.priority) and overlaps(
                cand.start, cand.end, rule.start, rule.end
            ):
                return f"c'è l'impegno «{rule.constraint.label or 'inderogabile'}»"
    return "c'è un conflitto"


def _violations(ctx: Context, cand: Candidate, d: date) -> list[Violation]:
    out = []
    for key, ds in cand.soft.items():
        if d in ds:
            rule = ctx.rule_by_key(key)
            if rule:
                c = rule.constraint
                out.append(Violation(constraint_id=c.id, student_id=rule.student_id, priority=c.priority, label=c.label))
    return out


def _assign_rooms(ctx: Context, occurrences: list[Occurrence]) -> int:
    if not ctx.p.rooms:
        return 0
    conflicts = 0
    by_date: dict[date, list[Occurrence]] = defaultdict(list)
    for o in occurrences:
        if o.mode == "presenza":
            by_date[o.date].append(o)
    rooms = sorted(ctx.p.rooms, key=lambda r: r.capacity)
    for occs in by_date.values():
        busy: dict[str, list[tuple[int, int]]] = defaultdict(list)
        for o in sorted(occs, key=lambda o: (o.start, -len(o.student_ids))):
            for r in rooms:
                if r.capacity < len(o.student_ids):
                    continue
                if any(overlaps(o.start, o.end, s, e) for s, e in busy[r.id]):
                    continue
                o.room_id = r.id
                busy[r.id].append((o.start, o.end))
                break
            else:
                conflicts += 1
    return conflicts


# ------------------------------------------------------------------ ingresso


def solve(problem: Problem) -> Solution:
    started = time.monotonic()
    deadline = started + problem.time_limit_s
    ctx = Context(problem)

    template, status, objective = _phase_a(ctx, started + problem.time_limit_s * 0.75)
    placed_b, movable, _ = _phase_b(ctx, template, deadline)

    occurrences: list[Occurrence] = []
    for it, cand, d, relocated in placed_b:
        ex = it.req.existing[it.index] if it.index < len(it.req.existing) else None
        occurrences.append(
            Occurrence(
                request_id=it.req.id,
                session_index=it.index,
                date=d,
                start=cand.start,
                end=cand.end,
                tutor_id=cand.tutor_id,
                student_ids=it.req.student_ids,
                subject_id=it.req.subject_id,
                mode=cand.mode,
                duration_changed=cand.duration != it.req.duration,
                requested_duration=it.req.duration,
                relocated=relocated,
                moved_from_existing=bool(ex) and not _existing_match(cand, ex) and not relocated,
                violations=_violations(ctx, cand, d),
            )
        )
    occurrences.sort(key=lambda o: (o.date, o.start, o.tutor_id))
    room_conflicts = _assign_rooms(ctx, occurrences)

    weekly_occ = Occupancy(ctx.slot)
    for it in template:
        if it.chosen is not None:
            weekly_occ.add(it.chosen.weekday, it.chosen, it.req.student_ids, ctx.cells(it.chosen.start, it.chosen.end))

    unplaced: list[Unplaced] = []
    for it in template:
        if it.chosen is None:
            reasons, suggestions = _explain_weekly(ctx, it.req, weekly_occ)
            ex = it.req.existing[it.index] if it.index < len(it.req.existing) else None
            if ex is not None and ex.locked:
                reasons.insert(0, "La collocazione bloccata non è più compatibile con i vincoli attuali.")
            unplaced.append(
                Unplaced(
                    request_id=it.req.id,
                    session_index=it.index,
                    student_ids=it.req.student_ids,
                    subject_id=it.req.subject_id,
                    reasons=reasons,
                    suggestions=suggestions,
                )
            )
    for it in movable:
        if it.chosen is not None:
            continue
        if it.origin_date is not None:
            why = _conflict_reason(ctx, it.req, it.origin, it.origin_date)
            reasons = [
                f"Il {it.origin_date.strftime('%d/%m')} {why} e non c'è un altro spazio libero nella stessa settimana."
            ]
        else:
            reasons, _ = _explain_weekly(ctx, it.req, weekly_occ)
        unplaced.append(
            Unplaced(
                request_id=it.req.id,
                session_index=it.index,
                date=it.origin_date,
                student_ids=it.req.student_ids,
                subject_id=it.req.subject_id,
                reasons=reasons,
            )
        )

    return Solution(
        status=status,
        occurrences=occurrences,
        unplaced=unplaced,
        group_suggestions=suggest_groups(ctx),
        objective=objective,
        solve_seconds=round(time.monotonic() - started, 3),
        stats={
            "sessions": len(template),
            "sessions_placed": sum(1 for it in template if it.chosen is not None),
            "occurrences": len(occurrences),
            "relocated": sum(1 for o in occurrences if o.relocated),
            "unplaced": len(unplaced),
            "room_conflicts": room_conflicts,
        },
    )
