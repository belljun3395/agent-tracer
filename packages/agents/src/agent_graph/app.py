"""세 에이전트와 취소를 노출하며 실행 결과를 요청한 HTTP 연결이 아니라 완료 창구로 배달하는 FastAPI 앱이다."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import BackgroundTasks, FastAPI, Request
from fastapi.responses import StreamingResponse

from .agents.chat.agent import run_chat, stream_chat
from .agents.chat.checkpoint import ChatCheckpointProvider
from .agents.chat.models import ChatRequest, ChatStreamRequest
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
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    shutdown_observability = configure_observability()
    application.state.completion_client = httpx.AsyncClient(timeout=COMPLETION_CALLBACK_TIMEOUT_S)
    settings = get_settings()
    application.state.ledger = LedgerPoolProvider(settings.tracer_writer_dsn())
    application.state.chat_checkpoints = ChatCheckpointProvider(settings.tracer_writer_dsn())
    application.state.search = create_search_client(settings.opensearch_node)
    try:
        yield
    finally:
        shutdown_observability()
        await application.state.completion_client.aclose()
        await application.state.ledger.close()
        await application.state.chat_checkpoints.close()
        await application.state.search.close()


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


async def chat(
    req: ChatRequest,
    background: BackgroundTasks,
    request: Request,
) -> AgentAccepted:
    return accept(
        "chat",
        req,
        lambda trace: run_chat(
            req,
            request.app.state.completion_client,
            request.app.state.ledger,
            trace,
            request.app.state.chat_checkpoints,
        ),
        background,
        request,
    )


async def chat_stream(req: ChatStreamRequest, request: Request) -> StreamingResponse:
    """대화 턴을 열린 HTTP 연결로 토큰 스트림 배달하며, 연결이 끊기면 실행을 취소한다."""
    return StreamingResponse(
        stream_chat(
            req,
            request.app.state.completion_client,
            request.app.state.ledger,
            request.app.state.chat_checkpoints,
        ),
        media_type="application/x-ndjson",
    )


async def cancel_run_endpoint(run_id: str) -> dict[str, bool]:
    return {"cancelled": cancel_run(run_id)}


def create_app() -> FastAPI:
    """독립 수명을 가진 에이전트 HTTP 앱을 만든다."""
    application = FastAPI(title="agent-graph", lifespan=lifespan)
    application.get("/health")(health)
    application.post("/agents/title-suggestion", status_code=202)(title_suggestion)
    application.post("/agents/task-cleanup", status_code=202)(task_cleanup)
    application.post("/agents/recipe-scan", status_code=202)(recipe_scan)
    application.post("/agents/chat", status_code=202)(chat)
    application.post("/agents/chat/stream")(chat_stream)
    application.post("/agents/runs/{run_id}/cancel")(cancel_run_endpoint)
    return application


app = create_app()
