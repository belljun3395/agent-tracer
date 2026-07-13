"""FastAPI 앱. 세 에이전트와 취소 엔드포인트를 노출한다.

오류는 HTTP 실패가 아니라 응답 본문 error 필드로 돌려준다. TS 러너 계약과 동일하게
호출부(temporal-worker)가 errorSubtype으로 재시도 여부를 판단하게 하기 위함이다.
취소(asyncio.CancelledError)는 이 정규화 대상이 아니다. runtime/execution/runner.py가 그대로
재전파하므로 이 경우 에이전트 엔드포인트는 정상 응답을 돌려주지 않고 연결이 끊긴다.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request

from .agents.recipe_scan.agent import run_recipe_scan
from .agents.recipe_scan.models import RecipeScanRequest
from .agents.runtime.execution.registry import cancel_run
from .agents.runtime.execution.runner import execute
from .agents.runtime.telemetry.bootstrap import configure_observability
from .agents.runtime.telemetry.propagation import extract_trace_context
from .agents.shared.models import AgentResponse
from .agents.task_cleanup.agent import run_task_cleanup
from .agents.task_cleanup.models import TaskCleanupRequest
from .agents.title_suggestion.agent import run_title_suggestion
from .agents.title_suggestion.models import TitleSuggestionRequest

TOOL_CALLBACK_TIMEOUT_S = 60.0


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    shutdown_observability = configure_observability()
    app.state.tool_client = httpx.AsyncClient(timeout=TOOL_CALLBACK_TIMEOUT_S)
    try:
        yield
    finally:
        shutdown_observability()
        await app.state.tool_client.aclose()


app = FastAPI(title="agent-graph", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/agents/title-suggestion", response_model=AgentResponse)
async def title_suggestion(req: TitleSuggestionRequest, request: Request) -> AgentResponse:
    client: httpx.AsyncClient = app.state.tool_client
    return await execute(
        "title-suggestion",
        req.model,
        req.deadlineMs,
        lambda u: run_title_suggestion(req, client, u),
        req.jobId,
        req.idempotencyKey,
        None,
        extract_trace_context(dict(request.headers)),
    )


@app.post("/agents/task-cleanup", response_model=AgentResponse)
async def task_cleanup(req: TaskCleanupRequest, request: Request) -> AgentResponse:
    client: httpx.AsyncClient = app.state.tool_client
    return await execute(
        "task-cleanup",
        req.model,
        req.deadlineMs,
        lambda u: run_task_cleanup(req, client, u),
        req.jobId,
        req.idempotencyKey,
        None,
        extract_trace_context(dict(request.headers)),
    )


@app.post("/agents/recipe-scan", response_model=AgentResponse)
async def recipe_scan(req: RecipeScanRequest, request: Request) -> AgentResponse:
    client: httpx.AsyncClient = app.state.tool_client
    return await execute(
        "recipe-scan",
        req.model,
        req.deadlineMs,
        lambda u: run_recipe_scan(req, client, u),
        req.jobId,
        req.idempotencyKey,
        None,
        extract_trace_context(dict(request.headers)),
    )


@app.post("/agents/runs/{run_id}/cancel")
async def cancel_run_endpoint(run_id: str) -> dict[str, bool]:
    return {"cancelled": cancel_run(run_id)}
