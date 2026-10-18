"""Modelli dati del motore di pianificazione.

Convenzioni:
- i giorni della settimana vanno da 0 (lunedì) a 6 (domenica);
- gli orari sono minuti dalla mezzanotte (es. 17:30 -> 1050);
- le priorità dei vincoli vanno da 1 (inderogabile) a 4 (gradimento).
"""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

Mode = Literal["presenza", "online"]


class TimeWindow(BaseModel):
    """Fascia oraria settimanale ricorrente."""

    weekday: int = Field(ge=0, le=6)
    start: int = Field(ge=0, le=1440)
    end: int = Field(ge=0, le=1440)

    @model_validator(mode="after")
    def _check(self) -> "TimeWindow":
        if self.end <= self.start:
            raise ValueError("la fascia deve finire dopo l'inizio")
        return self


class DatedWindow(BaseModel):
    """Fascia oraria in una data precisa. Senza orari copre tutto il giorno."""

    date: date
    start: int = Field(default=0, ge=0, le=1440)
    end: int = Field(default=1440, ge=0, le=1440)

    @model_validator(mode="after")
    def _check(self) -> "DatedWindow":
        if self.end <= self.start:
            raise ValueError("la fascia deve finire dopo l'inizio")
        return self


class Constraint(BaseModel):
    """Impegno di uno studente: il motore evita di metterci lezioni.

    Priorità 1 = inderogabile (mai violato), 2 = importante, 3 = preferenza,
    4 = gradimento. Esattamente uno tra `weekly` e `dated` è valorizzato.
    """

    id: str
    priority: int = Field(ge=1, le=4)
    label: str = ""
    weekly: Optional[TimeWindow] = None
    dated: Optional[DatedWindow] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None

    @model_validator(mode="after")
    def _check(self) -> "Constraint":
        if (self.weekly is None) == (self.dated is None):
            raise ValueError("un vincolo deve essere settimanale oppure datato")
        return self


class Center(BaseModel):
    hours: list[TimeWindow]
    closed_dates: list[date] = []
    slot_minutes: int = Field(default=30, ge=5, le=60)


class Room(BaseModel):
    id: str
    name: str = ""
    capacity: int = Field(default=1, ge=1)


class Tutor(BaseModel):
    id: str
    name: str = ""
    subjects: list[str]
    modes: list[Mode] = ["presenza", "online"]
    availability: list[TimeWindow]
    unavailable: list[DatedWindow] = []
    max_weekly_minutes: Optional[int] = None
    max_daily_minutes: Optional[int] = None


class Student(BaseModel):
    id: str
    name: str = ""
    constraints: list[Constraint] = []
    max_lessons_per_day: Optional[int] = None


class ExistingAssignment(BaseModel):
    """Collocazione già in calendario per una sessione settimanale.

    `locked` = confermata e da non toccare; altrimenti il motore la sposta solo
    se serve, pagando una penalità.
    """

    weekday: int = Field(ge=0, le=6)
    start: int
    tutor_id: str
    duration: int
    locked: bool = False


class RequestKind(str, Enum):
    ricorrente = "ricorrente"
    singola = "singola"


class LessonRequest(BaseModel):
    """Fabbisogno di lezioni di uno studente (o di un gruppo approvato)."""

    id: str
    student_ids: list[str] = Field(min_length=1)
    subject_id: str
    kind: RequestKind = RequestKind.ricorrente
    sessions_per_week: int = Field(default=1, ge=1, le=7)
    duration: int = Field(default=60, ge=15)
    flexible_duration: bool = True
    mode: Literal["presenza", "online", "indifferente"] = "presenza"
    tutor_ids: list[str] = []
    preferred_tutor_id: Optional[str] = None
    priority: int = Field(default=2, ge=1, le=3)
    level: Optional[str] = None
    topic: Optional[str] = None
    window_from: Optional[date] = None
    window_to: Optional[date] = None
    existing: list[ExistingAssignment] = []

    @model_validator(mode="after")
    def _check(self) -> "LessonRequest":
        if self.kind == RequestKind.singola and self.sessions_per_week != 1:
            raise ValueError("una richiesta singola ha una sola sessione")
        return self


class Weights(BaseModel):
    """Pesi dell'obiettivo. Collocare una lezione vale sempre più di qualunque
    violazione di vincoli P2-P4, che quindi vengono sacrificati dal meno
    importante; i vincoli in `hard_priorities` non vengono mai violati."""

    place: int = 100_000
    hard_priorities: list[int] = [1]
    violation: dict[int, int] = {2: 20_000, 3: 4_000, 4: 500}
    duration_change_per_30: int = 1_500
    move_existing: int = 3_000
    not_preferred_tutor: int = 800
    online_when_indifferent: int = 100
    same_day_same_request: int = 5_000
    tutor_day: int = 150
    partial_hard_conflict_per_date: int = 1_000
    request_priority_multiplier: dict[int, float] = {1: 1.5, 2: 1.0, 3: 0.7}


class Problem(BaseModel):
    period_start: date
    period_end: date
    center: Center
    rooms: list[Room] = []
    tutors: list[Tutor]
    students: list[Student]
    requests: list[LessonRequest]
    weights: Weights = Weights()
    time_limit_s: float = Field(default=30.0, gt=0, le=600)
    workers: int = Field(default=8, ge=1, le=32)
    duration_bounds: tuple[int, int] = (60, 120)

    @model_validator(mode="after")
    def _check(self) -> "Problem":
        if self.period_end < self.period_start:
            raise ValueError("periodo non valido")
        return self


# ---------------------------------------------------------------- risultato


class Violation(BaseModel):
    constraint_id: str
    student_id: str
    priority: int
    label: str


class Occurrence(BaseModel):
    """Una singola lezione in calendario."""

    request_id: str
    session_index: int
    date: date
    start: int
    end: int
    tutor_id: str
    student_ids: list[str]
    subject_id: str
    mode: Mode
    room_id: Optional[str] = None
    duration_changed: bool = False
    requested_duration: int
    relocated: bool = False
    moved_from_existing: bool = False
    violations: list[Violation] = []


class Unplaced(BaseModel):
    request_id: str
    session_index: Optional[int] = None
    date: Optional[date] = None
    student_ids: list[str]
    subject_id: str
    reasons: list[str]
    suggestions: list[str] = []


class GroupSuggestion(BaseModel):
    request_ids: list[str]
    student_ids: list[str]
    subject_id: str
    level: Optional[str] = None
    topic: Optional[str] = None
    tutor_ids: list[str]
    common_slots: int
    note: str


class Solution(BaseModel):
    status: str
    occurrences: list[Occurrence]
    unplaced: list[Unplaced]
    group_suggestions: list[GroupSuggestion] = []
    objective: Optional[float] = None
    solve_seconds: float
    stats: dict[str, int] = {}
