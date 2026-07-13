"""에이전트 전용 도구가 공유하는 콜백 전송 경로."""

from __future__ import annotations

from agent_graph.agents.runtime.callback import invoke_remote_tool
from agent_graph.agents.shared.models import ToolCallback
from tests.fakes import FakeToolClient

_CALLBACK = ToolCallback(url="http://worker:8810/tools/invoke", token="tok-1")


class TestInvokeRemoteTool:
    async def test_도구_이름과_인자를_콜백으로_보낸다(self) -> None:
        client = FakeToolClient({"get_task_events": ["ok"]})

        result = await invoke_remote_tool(
            client, _CALLBACK, "get_task_events", {"taskId": "t1", "limit": 10}
        )  # type: ignore[arg-type]

        assert result == '["ok"]'
        assert client.calls == ["get_task_events"]
        assert client.args == [{"taskId": "t1", "limit": 10}]
        assert client.tokens == ["tok-1"]

    async def test_도구_오류는_모델이_읽는_문자열로_돌아온다(self) -> None:
        client = FakeToolClient({})

        result = await invoke_remote_tool(client, _CALLBACK, "a", {"taskId": "t1"})  # type: ignore[arg-type]

        assert result == "Tool a failed: Unknown tool: a"
