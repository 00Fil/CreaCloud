"""Suggerimenti di lezioni di gruppo.

Il motore non crea gruppi da solo: li propone al coordinatore quando più
studenti chiedono la stessa materia (e lo stesso livello/argomento, se
indicati) e hanno fasce compatibili con almeno un tutor in comune.
"""

from __future__ import annotations

from collections import defaultdict
from typing import TYPE_CHECKING

from .models import GroupSuggestion, RequestKind

if TYPE_CHECKING:
    from .context import Context

MIN_COMMON_SLOTS = 2
DEFAULT_MAX_GROUP = 4


def suggest_groups(ctx: "Context") -> list[GroupSuggestion]:
    max_size = int(min(ctx.max_room_capacity, DEFAULT_MAX_GROUP)) if ctx.room_caps else DEFAULT_MAX_GROUP
    if max_size < 2:
        return []
    pools: dict[tuple, list] = defaultdict(list)
    for req in ctx.p.requests:
        if req.kind != RequestKind.ricorrente or len(req.student_ids) != 1:
            continue
        pools[(req.subject_id, req.level or "", (req.topic or "").strip().lower())].append(req)

    out: list[GroupSuggestion] = []
    for (subject, level, topic), reqs in pools.items():
        if len(reqs) < 2:
            continue
        slots = {}
        for req in reqs:
            slots[req.id] = {
                (c.weekday, c.start, c.tutor_id)
                for c in ctx.weekly_candidates(req)
                if c.duration == req.duration and not c.hard_dates
            }
        remaining = sorted(reqs, key=lambda r: len(slots[r.id]))
        while len(remaining) >= 2:
            seed = remaining.pop(0)
            group, common = [seed], slots[seed.id]
            for other in list(remaining):
                if len(group) >= max_size or other.duration != seed.duration:
                    continue
                inter = common & slots[other.id]
                if len(inter) >= MIN_COMMON_SLOTS:
                    group.append(other)
                    common = inter
                    remaining.remove(other)
            if len(group) < 2:
                continue
            tutors = sorted({t for _, _, t in common})
            out.append(
                GroupSuggestion(
                    request_ids=[r.id for r in group],
                    student_ids=[r.student_ids[0] for r in group],
                    subject_id=subject,
                    level=level or None,
                    topic=topic or None,
                    tutor_ids=tutors,
                    common_slots=len(common),
                    note=f"{len(common)} fasce orarie in comune: valuta una lezione di gruppo.",
                )
            )
    return out
