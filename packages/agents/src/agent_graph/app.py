"""FastAPI 앱. 세 에이전트와 취소 엔드포인트를 노출한다.

에이전트 요청은 실행을 접수만 하고 곧바로 응답한다. 결과는 요청한 HTTP 연결이 아니라 워커가
이 실행에만 발급한 완료 창구로 돌아가므로, 연결이 끊겨도 진행 중인 유료 실행을 잃지 않는다.
오류는 HTTP 실패가 아니라 완료 본문의 error 필드로 돌려준다. 호출부(ai-agent-worker)가
errorSubtype으로 재시도 여부를 판단하게 하기 위함이다. 취소는 이 정규화 대상이 아니며,
취소된 실행은 완료 창구로 아무것도 전달하지 않는다.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import BackgroundTasks, FastAPI, Request

from .agents.recipe_scan.agent import run_recipe_scan
from .agents.recipe_scan.models import RecipeScanRequest
from .agents.runtime.execution.completion import run_and_deliver
from .agents.runtime.execution.registry import cancel_run
from .agents.runtime.execution.runner import AgentBody, execute
from .agents.runtime.ledger import LedgerPoolProvider
from .agents.runtime.search import create_search_client
from .agents.runtime.telemetry.bootstrap import configure_observability
from .agents.runtime.telemetry.propagation import extract_trace_context
from .agents.shared.models import AgentAccepted, AgentExecutionRequest, AgentResponse
from .agents.task_cleanup.agent import run_task_cleanup
from .agents.task_cleanup.models import TaskCleanupRequest
from .agents.title_suggestion.agent import run_title_suggestion
from .agents.title_suggestion.models import TitleSuggestionRequest
from .config import get_settings

COMPLETION_CALLBACK_TIMEOUT_S = 30.0


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    shutdown_observability = configure_observability()
    app.state.completion_client = httpx.AsyncClient(timeout=COMPLETION_CALLBACK_TIMEOUT_S)
    settings = get_settings()
    app.state.ledger = LedgerPoolProvider(settings.tracer_dsn())
    app.state.search = create_search_client(settings.opensearch_node)
    try:
        yield
    finally:
        shutdown_observability()
        await app.state.completion_client.aclose()
        await app.state.ledger.close()
        await app.state.search.close()


def accept(
    label: str,
    req: AgentExecutionRequest,
    body: AgentBody,
    background: BackgroundTasks,
    request: Request,
) -> AgentAccepted:
    """실행을 배경으로 넘기고 접수만 응답한다."""
    parent_context = extract_trace_context(dict(request.headers))

    async def run() -> AgentResponse:
        return await execute(
            label,
            req.model,
            req.deadlineMs,
            body,
            req.jobId,
            req.idempotencyKey,
            None,
            parent_context,
            req.idempotency_input_hash(),
        )

    background.add_task(run_and_deliver, request.app.state.completion_client, req.completionCallback, run)
    return AgentAccepted(runId=req.idempotencyKey or req.jobId or "")


async def health() -> dict[str, str]:
    return {"status": "ok"}


async def title_suggestion(
    req: TitleSuggestionRequest,
    background: BackgroundTasks,
    request: Request,
) -> AgentAccepted:
    return accept(
        "title-suggestion",
        req,
        lambda trace: run_title_suggestion(req, request.app.state.ledger, trace),
        background,
        request,
    )


async def task_cleanup(
    req: TaskCleanupRequest,
    background: BackgroundTasks,
    request: Request,
) -> AgentAccepted:
    return accept(
        "task-cleanup",
        req,
        lambda trace: run_task_cleanup(req, request.app.state.ledger, trace),
        background,
        request,
    )


async def recipe_scan(
    req: RecipeScanRequest,
    background: BackgroundTasks,
    request: Request,
) -> AgentAccepted:
    return accept(
        "recipe-scan",
        req,
        lambda trace: run_recipe_scan(req, request.app.state.ledger, request.app.state.search, trace),
        background,
        request,
    )


async def cancel_run_endpoint(run_id: str) -> dict[str, bool]:
    return {"cancelled": cancel_run(run_id)}


def create_app() -> FastAPI:
    """독립 수명을 가진 에이전트 HTTP 앱을 만든다."""
    app = FastAPI(title="agent-graph", lifespan=lifespan)
    app.get("/health")(health)
    app.post("/agents/title-suggestion", status_code=202)(title_suggestion)
    app.post("/agents/task-cleanup", status_code=202)(task_cleanup)
    app.post("/agents/recipe-scan", status_code=202)(recipe_scan)
    app.post("/agents/runs/{run_id}/cancel")(cancel_run_endpoint)
    return app


app = create_app()
