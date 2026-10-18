"""API HTTP del motore. Senza stato: riceve il problema, restituisce il piano."""

from __future__ import annotations

import hmac
import os

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.concurrency import run_in_threadpool

from .context import Context
from .groups import suggest_groups
from .models import GroupSuggestion, Problem, Solution
from .solver import solve

app = FastAPI(title="Creattivamente – motore di pianificazione")


def check_token(authorization: str = Header(default="")) -> None:
    expected = os.environ.get("ENGINE_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=500, detail="ENGINE_TOKEN non configurato")
    if not hmac.compare_digest(authorization, f"Bearer {expected}"):
        raise HTTPException(status_code=401, detail="non autorizzato")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/solve", response_model=Solution, dependencies=[Depends(check_token)])
async def solve_endpoint(problem: Problem) -> Solution:
    return await run_in_threadpool(solve, problem)


@app.post("/suggest-groups", response_model=list[GroupSuggestion], dependencies=[Depends(check_token)])
async def groups_endpoint(problem: Problem) -> list[GroupSuggestion]:
    return await run_in_threadpool(lambda: suggest_groups(Context(problem)))
