from datetime import date

import random
import time

from engine import Problem, solve
from engine.models import (
    Center,
    Constraint,
    DatedWindow,
    ExistingAssignment,
    LessonRequest,
    Room,
    Student,
    TimeWindow,
    Tutor,
)

H = 60
OCT_START, OCT_END = date(2026, 10, 1), date(2026, 10, 31)


def center(**kw):
    hours = [TimeWindow(weekday=d, start=14 * H, end=20 * H) for d in range(5)]
    return Center(hours=hours, **kw)


def tutor(tid, subjects=("mat",), days=range(5), start=14 * H, end=20 * H, **kw):
    return Tutor(
        id=tid,
        name=tid.capitalize(),
        subjects=list(subjects),
        availability=[TimeWindow(weekday=d, start=start, end=end) for d in days],
        **kw,
    )


def problem(**kw):
    base = dict(period_start=OCT_START, period_end=OCT_END, center=center(), time_limit_s=10, workers=4)
    base.update(kw)
    return Problem(**base)


def weekly(cid, priority, weekday, start, end, label="impegno"):
    return Constraint(
        id=cid, priority=priority, label=label, weekly=TimeWindow(weekday=weekday, start=start, end=end)
    )


def test_places_recurring_lessons_every_week():
    p = problem(
        tutors=[tutor("rossi")],
        students=[Student(id="luca", name="Luca")],
        requests=[LessonRequest(id="r1", student_ids=["luca"], subject_id="mat", sessions_per_week=2, duration=90)],
    )
    sol = solve(p)
    assert sol.unplaced == []
    # ottobre 2026: 22 giorni feriali, due sessioni a settimana in giorni diversi
    weekdays = {o.date.weekday() for o in sol.occurrences}
    assert len(weekdays) == 2
    assert all(o.end - o.start == 90 for o in sol.occurrences)
    per_week = {}
    for o in sol.occurrences:
        per_week.setdefault(o.date.isocalendar()[1], []).append(o)
    assert all(len(v) <= 2 for v in per_week.values())


def test_no_tutor_or_student_overlap():
    p = problem(
        center=Center(hours=[TimeWindow(weekday=0, start=15 * H, end=18 * H)]),
        tutors=[tutor("rossi", days=[0], start=15 * H, end=18 * H)],
        students=[Student(id=s) for s in "abc"],
        requests=[
            LessonRequest(id=f"r{s}", student_ids=[s], subject_id="mat", duration=60, flexible_duration=False)
            for s in "abc"
        ],
    )
    sol = solve(p)
    assert sol.unplaced == []
    by_date = {}
    for o in sol.occurrences:
        by_date.setdefault(o.date, []).append((o.start, o.end))
    for slots in by_date.values():
        slots.sort()
        assert all(a[1] <= b[0] for a, b in zip(slots, slots[1:]))


def test_p1_never_violated_and_reported_when_impossible():
    p = problem(
        center=Center(hours=[TimeWindow(weekday=0, start=15 * H, end=17 * H)]),
        tutors=[tutor("rossi", days=[0], start=15 * H, end=17 * H)],
        students=[Student(id="luca", constraints=[weekly("scuola", 1, 0, 14 * H, 18 * H, "rientro scuola")])],
        requests=[LessonRequest(id="r1", student_ids=["luca"], subject_id="mat")],
    )
    sol = solve(p)
    assert sol.occurrences == []
    assert len(sol.unplaced) == 1
    assert any("inderogabile" in r for r in sol.unplaced[0].reasons)


def test_low_priority_constraint_is_sacrificed_first():
    # Solo due fasce possibili: una viola un vincolo P2, l'altra un P4.
    p = problem(
        center=Center(hours=[TimeWindow(weekday=0, start=15 * H, end=17 * H)]),
        tutors=[tutor("rossi", days=[0], start=15 * H, end=17 * H)],
        students=[
            Student(
                id="luca",
                constraints=[
                    weekly("calcio", 2, 0, 15 * H, 16 * H, "allenamento calcio"),
                    weekly("tardi", 4, 0, 16 * H, 17 * H, "preferirebbe non tardi"),
                ],
            )
        ],
        requests=[LessonRequest(id="r1", student_ids=["luca"], subject_id="mat", flexible_duration=False)],
    )
    sol = solve(p)
    assert sol.unplaced == []
    assert all(o.start == 16 * H for o in sol.occurrences)
    assert all([v.constraint_id for v in o.violations] == ["tardi"] for o in sol.occurrences)


def test_holiday_lesson_is_relocated_in_same_week():
    holiday = date(2026, 10, 13)  # martedì
    p = problem(
        center=center(closed_dates=[holiday]),
        tutors=[tutor("rossi", days=[1, 3])],
        students=[Student(id="luca", constraints=[weekly("gio", 3, 3, 14 * H, 20 * H, "giovedì scomodo")])],
        requests=[LessonRequest(id="r1", student_ids=["luca"], subject_id="mat", sessions_per_week=1)],
    )
    sol = solve(p)
    assert sol.unplaced == []
    assert holiday not in {o.date for o in sol.occurrences}
    assert sum(1 for o in sol.occurrences if o.date.weekday() == 1) == 3
    (moved,) = [o for o in sol.occurrences if o.relocated]
    assert moved.date == date(2026, 10, 15)
    assert [v.constraint_id for v in moved.violations] == ["gio"]


def test_relocation_failure_is_reported_with_date():
    holiday = date(2026, 10, 12)  # lunedì, unico giorno disponibile
    p = problem(
        center=center(closed_dates=[holiday]),
        tutors=[tutor("rossi", days=[0])],
        students=[Student(id="luca")],
        requests=[LessonRequest(id="r1", student_ids=["luca"], subject_id="mat")],
    )
    sol = solve(p)
    (u,) = sol.unplaced
    assert u.date == holiday
    assert "centro è chiuso" in u.reasons[0]
    assert len(sol.occurrences) == 3


def test_unplaced_explains_busy_tutor():
    p = problem(
        center=Center(hours=[TimeWindow(weekday=0, start=15 * H, end=16 * H)]),
        tutors=[tutor("rossi", days=[0], start=15 * H, end=16 * H)],
        students=[Student(id="a"), Student(id="b")],
        requests=[
            LessonRequest(id="ra", student_ids=["a"], subject_id="mat", priority=1, flexible_duration=False),
            LessonRequest(id="rb", student_ids=["b"], subject_id="mat", priority=3, flexible_duration=False),
        ],
    )
    sol = solve(p)
    assert {o.request_id for o in sol.occurrences} == {"ra"}
    (u,) = sol.unplaced
    assert u.request_id == "rb"
    assert any("già occupato" in r for r in u.reasons)
    assert u.suggestions and "spostando" in u.suggestions[0]


def test_locked_existing_is_kept():
    p = problem(
        tutors=[tutor("rossi"), tutor("bianchi")],
        students=[Student(id="luca")],
        requests=[
            LessonRequest(
                id="r1",
                student_ids=["luca"],
                subject_id="mat",
                existing=[ExistingAssignment(weekday=3, start=18 * H, tutor_id="bianchi", duration=60, locked=True)],
            )
        ],
    )
    sol = solve(p)
    assert sol.occurrences
    assert all((o.date.weekday(), o.start, o.tutor_id) == (3, 18 * H, "bianchi") for o in sol.occurrences)


def test_unlocked_existing_preferred_but_movable():
    p = problem(
        tutors=[tutor("rossi")],
        students=[Student(id="luca", constraints=[weekly("nuoto", 2, 2, 17 * H, 19 * H, "nuoto")])],
        requests=[
            LessonRequest(
                id="r1",
                student_ids=["luca"],
                subject_id="mat",
                existing=[ExistingAssignment(weekday=2, start=17 * H, tutor_id="rossi", duration=60)],
            )
        ],
    )
    sol = solve(p)
    assert sol.occurrences
    assert all(o.moved_from_existing for o in sol.occurrences)
    assert all(not o.violations for o in sol.occurrences)


def test_rooms_limit_in_person_and_online_fills_gap():
    p = problem(
        center=Center(hours=[TimeWindow(weekday=0, start=15 * H, end=16 * H)]),
        rooms=[Room(id="aula1", capacity=1)],
        tutors=[tutor("rossi", days=[0], start=15 * H, end=16 * H), tutor("bianchi", days=[0], start=15 * H, end=16 * H)],
        students=[Student(id="a"), Student(id="b")],
        requests=[
            LessonRequest(id="ra", student_ids=["a"], subject_id="mat", mode="presenza", flexible_duration=False),
            LessonRequest(id="rb", student_ids=["b"], subject_id="mat", mode="indifferente", flexible_duration=False),
        ],
    )
    sol = solve(p)
    assert sol.unplaced == []
    modes = {o.request_id: o.mode for o in sol.occurrences}
    assert modes == {"ra": "presenza", "rb": "online"}
    assert all(o.room_id == "aula1" for o in sol.occurrences if o.mode == "presenza")


def test_duration_variation_flagged_when_needed():
    p = problem(
        center=Center(hours=[TimeWindow(weekday=0, start=15 * H, end=16 * H)]),
        tutors=[tutor("rossi", days=[0], start=15 * H, end=16 * H)],
        students=[Student(id="a")],
        requests=[LessonRequest(id="ra", student_ids=["a"], subject_id="mat", duration=90)],
    )
    sol = solve(p)
    assert sol.unplaced == []
    assert all(o.duration_changed and o.end - o.start == 60 for o in sol.occurrences)


def test_dated_p1_moves_only_that_occurrence():
    visit = date(2026, 10, 14)  # mercoledì
    p = problem(
        center=Center(hours=[TimeWindow(weekday=d, start=15 * H, end=16 * H) for d in (2, 4)]),
        tutors=[tutor("rossi", days=[2, 4], start=15 * H, end=16 * H)],
        students=[
            Student(
                id="a",
                constraints=[
                    weekly("venerdi", 3, 4, 15 * H, 16 * H, "preferisce non il venerdì"),
                    Constraint(id="visita", priority=1, label="visita medica", dated=DatedWindow(date=visit)),
                ],
            )
        ],
        requests=[LessonRequest(id="ra", student_ids=["a"], subject_id="mat", flexible_duration=False)],
    )
    sol = solve(p)
    assert sol.unplaced == []
    assert visit not in {o.date for o in sol.occurrences}
    relocated = [o for o in sol.occurrences if o.relocated]
    assert len(relocated) == 1 and relocated[0].date == date(2026, 10, 16)
    assert [v.constraint_id for v in relocated[0].violations] == ["venerdi"]


def test_single_request_within_window():
    p = problem(
        tutors=[tutor("rossi")],
        students=[Student(id="a")],
        requests=[
            LessonRequest(
                id="extra",
                student_ids=["a"],
                subject_id="mat",
                kind="singola",
                window_from=date(2026, 10, 19),
                window_to=date(2026, 10, 20),
            )
        ],
    )
    sol = solve(p)
    (o,) = sol.occurrences
    assert date(2026, 10, 19) <= o.date <= date(2026, 10, 20)


def test_group_suggestion_for_same_topic():
    p = problem(
        rooms=[Room(id="grande", capacity=4)],
        tutors=[tutor("rossi")],
        students=[Student(id="a", name="Anna"), Student(id="b", name="Bruno"), Student(id="c", name="Carla")],
        requests=[
            LessonRequest(id="ra", student_ids=["a"], subject_id="mat", level="3 media", topic="Equazioni"),
            LessonRequest(id="rb", student_ids=["b"], subject_id="mat", level="3 media", topic="equazioni"),
            LessonRequest(id="rc", student_ids=["c"], subject_id="mat", level="1 liceo", topic="equazioni"),
        ],
    )
    sol = solve(p)
    (g,) = sol.group_suggestions
    assert set(g.request_ids) == {"ra", "rb"}
    assert set(g.student_ids) == {"a", "b"} and "fasce" in g.note


def test_realistic_scale_80_students_10_tutors():
    rnd = random.Random(42)
    subjects = ["mat", "ita", "ing", "fis", "lat", "chi"]
    tutors = [
        tutor(
            f"t{i}",
            subjects=rnd.sample(subjects, 3),
            days=sorted(rnd.sample(range(5), 4)),
            start=14 * H + rnd.choice([0, 30, 60]),
            end=19 * H + rnd.choice([0, 30, 60]),
            max_weekly_minutes=20 * H,
        )
        for i in range(10)
    ]
    students, requests = [], []
    for i in range(80):
        cons = []
        for j, day in enumerate(rnd.sample(range(5), 2)):
            s = rnd.choice([15, 16, 17]) * H
            cons.append(weekly(f"c{j}", rnd.choice([1, 2, 3, 4]), day, s, s + 90, "sport"))
        students.append(Student(id=f"s{i}", constraints=cons))
        for subj in rnd.sample(subjects, rnd.choice([1, 1, 2])):
            requests.append(
                LessonRequest(
                    id=f"r{i}{subj}",
                    student_ids=[f"s{i}"],
                    subject_id=subj,
                    sessions_per_week=rnd.choice([1, 1, 2]),
                    duration=rnd.choice([60, 90, 120]),
                    mode=rnd.choice(["presenza", "presenza", "indifferente"]),
                )
            )
    p = problem(
        rooms=[Room(id=f"p{i}", capacity=1) for i in range(6)] + [Room(id="grande", capacity=4)],
        tutors=tutors,
        students=students,
        requests=requests,
        time_limit_s=30,
        workers=8,
    )
    t0 = time.monotonic()
    sol = solve(p)
    elapsed = time.monotonic() - t0
    assert elapsed < 90
    assert sol.stats["sessions_placed"] / sol.stats["sessions"] > 0.8
    assert sol.stats["room_conflicts"] == 0
    # nessuna violazione di vincoli P1
    assert all(v.priority != 1 for o in sol.occurrences for v in o.violations)
    for u in sol.unplaced:
        assert u.reasons
    print(sol.stats, f"{elapsed:.1f}s")
