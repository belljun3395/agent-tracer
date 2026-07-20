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
from agent_graph.agents.task_cleanup.langchain_agent import build_cleanup_agent
from agent_graph.agents.task_cleanup.policy import (
    AGENT_RECURSION_LIMIT as CLEANUP_RECURSION_LIMIT,
)
from agent_graph.agents.task_cleanup.policy import MAX_TOOL_ROUNDS as CLEANUP_ROUNDS
from agent_graph.agents.title_suggestion.langchain_agent import build_title_agent
from agent_graph.agents.title_suggestion.policy import (
    AGENT_RECURSION_LIMIT as TITLE_RECURSION_LIMIT,
)
from agent_graph.agents.title_suggestion.policy import MAX_TOOL_ROUNDS as TITLE_ROUNDS
from tests.support.fakes import FakeToolLoopChat


def _loop_supersteps(agent: CompiledStateGraph[Any, Any, Any, Any]) -> int:
    return len([name for name in agent.get_graph().nodes if not name.startswith("__")])


def _agents() -> list[tuple[str, CompiledStateGraph[Any, Any, Any, Any], int, int]]:
    chat = FakeToolLoopChat([])
    return [
        (
            "task-cleanup",
            build_cleanup_agent(chat, "system"),
            CLEANUP_ROUNDS,
            CLEANUP_RECURSION_LIMIT,
        ),
        (
            "recipe-scan",
            build_recipe_agent(chat, "system", RECIPE_ROUNDS),
            RECIPE_ROUNDS,
            RECIPE_RECURSION_LIMIT,
        ),
        (
            "title-suggestion",
            build_title_agent(chat, "system"),
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
