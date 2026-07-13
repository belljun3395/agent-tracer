"""에이전트 실행 전체의 사용량과 반환 궤적을 소유한다."""

from __future__ import annotations

from dataclasses import dataclass, field

from langchain_core.messages import AIMessage, BaseMessage

from ...shared.models import AgentStepDTO, GraphEventKind, UsageDTO
from ..llm.trajectory import cap_step_content, extract_token_usage, message_identity, message_step


@dataclass
class ExecutionTrace:
    """한 에이전트 실행에서 관측한 사용량과 단계를 누적한다."""

    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_creation_tokens: int = 0
    turns: int = 0
    seen: bool = field(default=False)
    steps: list[AgentStepDTO] = field(default_factory=list)
    actual_model: str | None = None
    provider_request_id: str | None = None

    def add_message(self, message: BaseMessage) -> None:
        """AI 응답의 모델 식별자와 토큰 사용량을 더한다."""
        if not isinstance(message, AIMessage):
            return
        self.turns += 1
        self._remember_identity(message)
        usage = extract_token_usage(message)
        if usage is None:
            return
        self.seen = True
        self.input_tokens += usage.input_tokens
        self.output_tokens += usage.output_tokens
        self.cache_read_tokens += usage.cache_read_tokens
        self.cache_creation_tokens += usage.cache_creation_tokens

    def to_usage_dto(self) -> UsageDTO | None:
        """누적한 토큰이 있을 때 응답 사용량 계약을 만든다."""
        if not self.seen:
            return None
        return UsageDTO(
            inputTokens=self.input_tokens,
            outputTokens=self.output_tokens,
            cacheReadTokens=self.cache_read_tokens,
            cacheCreationTokens=self.cache_creation_tokens,
        )

    def record_message(self, message: BaseMessage) -> None:
        """모델 대화 메시지를 반환 가능한 실행 단계로 기록한다."""
        self._remember_identity(message)
        self.steps.append(message_step(message, len(self.steps)))

    def record_graph_event(
        self,
        event_kind: GraphEventKind,
        content: str,
        *,
        node_name: str | None = None,
        duration_ms: int | None = None,
    ) -> None:
        """그래프의 노드·분기·검증 이벤트를 실행 단계로 기록한다."""
        normalized = content.strip()
        if not normalized:
            raise ValueError("graph event content must not be empty")
        capped, truncated = cap_step_content(normalized)
        self.steps.append(
            AgentStepDTO(
                seq=len(self.steps),
                role="graph",
                content=capped,
                truncated=truncated,
                nodeName=node_name,
                eventKind=event_kind,
                durationMs=duration_ms,
            )
        )

    def _remember_identity(self, message: BaseMessage) -> None:
        actual_model, request_id = message_identity(message)
        self.actual_model = actual_model or self.actual_model
        self.provider_request_id = request_id or self.provider_request_id
