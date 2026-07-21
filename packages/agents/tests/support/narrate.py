"""테스트 실행 결과를 pytest -s로 보이는 사람이 읽는 서사로 렌더링한다."""

from __future__ import annotations

from typing import Any

from agent_graph.agents.recipe_scan.graph import RECIPE_SCAN_GRAPH
from agent_graph.agents.shared.models import AgentResponse
from agent_graph.agents.task_cleanup.graph import TASK_CLEANUP_GRAPH
from agent_graph.agents.title_suggestion.graph import TITLE_SUGGESTION_GRAPH

from .fakes import FakeToolLoopChat

_CONTENT_LIMIT = 500

_GRAPH_BY_LABEL = {
    "recipe-scan": RECIPE_SCAN_GRAPH,
    "task-cleanup": TASK_CLEANUP_GRAPH,
    "title-suggestion": TITLE_SUGGESTION_GRAPH,
}


def narrate(label: str, chat: FakeToolLoopChat, res: AgentResponse) -> None:
    """시나리오 이름 아래 그래프 위상·프롬프트 조합·노드와 응답의 타임라인·결과를 순서대로 찍는다."""
    print(f"\n===== {label} =====")
    _print_topology(label)
    _print_prompts(chat)
    _print_timeline(res)
    _print_result(res)


def _print_topology(label: str) -> None:
    for prefix, graph in _GRAPH_BY_LABEL.items():
        if label.startswith(prefix):
            print("-- topology --")
            print(graph.get_graph().draw_ascii())
            return


def _print_prompts(chat: FakeToolLoopChat) -> None:
    print("-- prompts --")
    if not chat.requests:
        print("  (모델을 한 번도 부르지 않았다)")
        return
    previous: list[Any] = []
    for call_index, messages in enumerate(chat.requests, start=1):
        is_continuation = messages[: len(previous)] == previous
        new_messages = messages[len(previous) :] if is_continuation else messages
        heading = (
            "call 1 (전체 조립)" if call_index == 1 else f"call {call_index} (+{len(new_messages)}개 추가)"
        )
        print(f"  [{heading}]")
        for message in new_messages:
            _print_message(message)
        previous = messages


def _print_message(message: Any) -> None:
    role = getattr(message, "type", type(message).__name__)
    content = getattr(message, "content", message)
    print(f"    {role}: {_short(content)}")
    for call in getattr(message, "tool_calls", None) or []:
        print(f"      tool_call {call.get('name')}({call.get('args')})")


def _print_timeline(res: AgentResponse) -> None:
    print("-- timeline --")
    steps = [step for step in res.steps if step.role in {"graph", "assistant", "tool"}]
    if not steps:
        print("  (기록된 스텝이 없다)")
        return
    for step in steps:
        if step.role == "graph":
            duration = f" {step.durationMs}ms" if step.durationMs is not None else ""
            print(f"  [{step.seq}] {step.nodeName} {step.eventKind}{duration}: {step.content}")
        elif step.role == "assistant":
            for call in step.toolCalls:
                print(f"  [{step.seq}]   ai → {call.name}({_short(str(call.args), 300)})")
            if step.content and not step.toolCalls:
                print(f"  [{step.seq}]   ai: {_short(step.content, 300)}")
        else:
            print(f"  [{step.seq}]   tool {step.toolName}: {_short(step.content, 200)}")


def _print_result(res: AgentResponse) -> None:
    print("-- result --")
    if res.error is not None:
        print(f"  error[{res.error.subtype}]: {res.error.summary}")
    else:
        print(f"  data: {res.data}")
    print(f"  turns={res.numTurns} usage={res.usage}")


def _short(content: Any, limit: int = _CONTENT_LIMIT) -> str:
    text = content if isinstance(content, str) else _flatten_blocks(content)
    return text if len(text) <= limit else text[:limit] + "…"


def _flatten_blocks(content: Any) -> str:
    # cache_control 경계를 위해 content-block 리스트로 온 메시지는 원시 dict repr 대신 실제 텍스트만 이어 붙인다.
    if isinstance(content, list) and all(isinstance(block, dict) and "text" in block for block in content):
        return "\n".join(str(block["text"]) for block in content)
    return str(content)
