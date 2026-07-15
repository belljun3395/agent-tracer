"""title-suggestion 표준 agent의 캐시 경계 계약을 검증한다."""

from langchain_core.messages import ToolMessage

from agent_graph.agents.title_suggestion.langchain_agent import _cache_tool_messages


def test_최근_도구_결과_두_개에만_캐시_경계를_둔다() -> None:
    messages = [
        ToolMessage(content=f"result-{index}", tool_call_id=f"call-{index}")
        for index in range(3)
    ]

    cached = _cache_tool_messages(messages)
    blocks = [message.content[0] for message in cached]

    assert "cache_control" not in blocks[0]
    assert [block["cache_control"] for block in blocks[1:]] == [
        {"type": "ephemeral"},
        {"type": "ephemeral"},
    ]
    assert [message.content for message in messages] == ["result-0", "result-1", "result-2"]
