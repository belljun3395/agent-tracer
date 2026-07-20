"""세 agent의 재귀 한도가 선언한 도구 라운드를 실제로 감당하는지 검증한다."""

from __future__ import annotations

from typing import Any

import pytest
from langgraph.graph.state import CompiledStateGraph

from agent_graph.agents.recipe_scan.langchain_agent import build_recipe_agent
from agent_graph.agents.recipe_scan.models import (
    AGENT_RECURSION_LIMIT as RECIPE_RECURSION_LIMIT,
)
from agent_graph.agents.recipe_scan.models import MAX_TOOL_ROUNDS as RECIPE_ROUNDS
from agent_graph.agents.recipe_scan.models import ProvenanceCatalog
from agent_graph.agents.recipe_scan.reader import RecipeLedgerReader
from agent_graph.agents.recipe_scan.search import RecipeSearchReader
from agent_graph.agents.recipe_scan.tools import build_recipe_registry as build_recipe_tool_registry
from agent_graph.agents.task_cleanup.langchain_agent import build_cleanup_agent
from agent_graph.agents.task_cleanup.models import CleanupBatch
from agent_graph.agents.task_cleanup.policy import (
    AGENT_RECURSION_LIMIT as CLEANUP_RECURSION_LIMIT,
)
from agent_graph.agents.task_cleanup.policy import MAX_TOOL_ROUNDS as CLEANUP_ROUNDS
from agent_graph.agents.task_cleanup.reader import CleanupLedgerReader
from agent_graph.agents.task_cleanup.tools import build_cleanup_registry
from agent_graph.agents.title_suggestion.langchain_agent import build_title_agent
from agent_graph.agents.title_suggestion.policy import (
    AGENT_RECURSION_LIMIT as TITLE_RECURSION_LIMIT,
)
from agent_graph.agents.title_suggestion.policy import MAX_TOOL_ROUNDS as TITLE_ROUNDS
from agent_graph.agents.title_suggestion.reader import TitleLedgerReader
from agent_graph.agents.title_suggestion.tools import build_title_registry
from tests.support.fakes import FakeLedger, FakeSearch, FakeToolLoopChat


def _loop_supersteps(agent: CompiledStateGraph[Any, Any, Any, Any]) -> int:
    return len([name for name in agent.get_graph().nodes if not name.startswith("__")])


def _agents() -> list[tuple[str, CompiledStateGraph[Any, Any, Any, Any], int, int]]:
    chat = FakeToolLoopChat([])
    cleanup_registry = build_cleanup_registry(
        CleanupLedgerReader(FakeLedger(), "user-1"),  # type: ignore[arg-type]
        CleanupBatch(),
        {},
        {},
        agent_name="task-cleanup",
    )
    recipe_registry = build_recipe_tool_registry(
        RecipeLedgerReader(FakeLedger(), "user-1"),  # type: ignore[arg-type]
        RecipeSearchReader(FakeSearch(), "user-1"),  # type: ignore[arg-type]
        ProvenanceCatalog(),
        agent_name="recipe-scan",
    )
    title_registry = build_title_registry(
        TitleLedgerReader(FakeLedger(), "user-1"),  # type: ignore[arg-type]
        agent_name="title-suggestion",
    )
    return [
        (
            "task-cleanup",
            build_cleanup_agent(
                chat,
                "system",
                cleanup_registry.langchain_tools(),
                cleanup_registry.transient_errors(),
            ),
            CLEANUP_ROUNDS,
            CLEANUP_RECURSION_LIMIT,
        ),
        (
            "recipe-scan",
            build_recipe_agent(
                chat,
                "system",
                recipe_registry.langchain_tools(),
                recipe_registry.transient_errors(),
            ),
            RECIPE_ROUNDS,
            RECIPE_RECURSION_LIMIT,
        ),
        (
            "title-suggestion",
            build_title_agent(chat, "system", title_registry.langchain_tools()),
            TITLE_ROUNDS,
            TITLE_RECURSION_LIMIT,
        ),
    ]


@pytest.mark.parametrize(("name", "agent", "rounds", "limit"), _agents())
def test_재귀_한도가_선언한_도구_라운드를_감당한다(
    name: str,
    agent: CompiledStateGraph[Any, Any, Any, Any],
    rounds: int,
    limit: int,
) -> None:
    supported = limit // _loop_supersteps(agent)

    assert supported >= rounds, (
        f"{name}: 재귀 한도 {limit}는 도구 라운드 {supported}회까지만 허용해 "
        f"선언한 예산 {rounds}회에 못 미친다"
    )
