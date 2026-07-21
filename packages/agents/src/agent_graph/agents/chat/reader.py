"""chat 읽기 도구가 tracer-api 읽기 API를 사용자 범위로 되읽는 HTTP 진입점을 소유한다."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

# tracer-api가 요청자를 식별하는 헤더이며 이 값이 조회의 사용자 범위를 정한다.
USER_HEADER = "x-monitor-user"


@dataclass(frozen=True)
class ReadEndpoint:
    """읽기 도구 하나가 되읽을 tracer-api 경로 틀과, 경로에 박히는 인자 이름이다."""

    path: str
    path_args: tuple[str, ...] = ()


READ_ENDPOINTS: dict[str, ReadEndpoint] = {
    "search_tasks": ReadEndpoint("/api/v1/tasks"),
    "get_task": ReadEndpoint("/api/v1/tasks/{taskId}", ("taskId",)),
    "get_timeline": ReadEndpoint("/api/v1/tasks/{taskId}/timeline", ("taskId",)),
    "search_events": ReadEndpoint("/api/v1/events/search"),
    "list_memos": ReadEndpoint("/api/v1/memos"),
    "list_rules": ReadEndpoint("/api/v1/rules"),
    "get_rule_evidence": ReadEndpoint("/api/v1/rules/{ruleId}/evidence", ("ruleId",)),
    "list_tags": ReadEndpoint("/api/v1/tags"),
    "list_recipes": ReadEndpoint("/api/v1/recipes"),
    "list_cleanup_suggestions": ReadEndpoint("/api/v1/task-cleanup/suggestions"),
    "get_job": ReadEndpoint("/api/v1/jobs/{jobId}", ("jobId",)),
    "list_settings": ReadEndpoint("/api/v1/settings"),
}


class ChatReadClient:
    """한 사용자의 읽기 API만 되읽도록 생성 시점에 범위가 묶인 HTTP 조회 진입점이다."""

    def __init__(self, client: httpx.AsyncClient, base_url: str, user_id: str) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._user_id = user_id

    async def read(self, tool_name: str, args: dict[str, object]) -> httpx.Response:
        """도구 이름에 맞는 읽기 API를 사용자 헤더와 함께 GET으로 되읽는다."""
        endpoint = READ_ENDPOINTS[tool_name]
        path = endpoint.path
        params: dict[str, Any] = {}
        for key, value in args.items():
            if value is None:
                continue
            if key in endpoint.path_args:
                path = path.replace("{" + key + "}", str(value))
            else:
                params[key] = value
        return await self._client.get(
            f"{self._base_url}{path}",
            params=params,
            headers={USER_HEADER: self._user_id},
        )
