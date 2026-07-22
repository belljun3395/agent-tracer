"""공통 채팅 DB에서 LangGraph가 대화 문맥을 직접 복원한다."""

from __future__ import annotations

from typing import Any

from ..runtime.ledger import LedgerPoolProvider
from .models import ChatFact, ChatHistoryMessage

RECENT_WITH_SUMMARY = 8


class ChatContextReader:
    """실행 식별자를 기준으로 대화 기록·요약·사용자 기억을 정본 DB에서 읽는다."""

    def __init__(self, ledger: LedgerPoolProvider, user_id: str, thread_id: str, execution_id: str) -> None:
        self._ledger = ledger
        self._user_id = user_id
        self._thread_id = thread_id
        self._execution_id = execution_id

    async def load(self) -> tuple[list[ChatHistoryMessage], str | None, list[ChatFact]]:
        pool = await self._ledger.pool()
        async with pool.acquire() as connection:
            thread = await connection.fetchrow(
                "SELECT summary FROM agent_chat_thread_view WHERE id = $1 AND user_id = $2",
                self._thread_id,
                self._user_id,
            )
            if thread is None:
                raise ValueError("chat thread not found")
            rows = await connection.fetch(
                """
                WITH target AS (
                    SELECT created_at, id FROM agent_chat_execution_view
                    WHERE id = $1 AND thread_id = $2 AND user_id = $3
                )
                SELECT e.user_message_id, e.assistant_message_id, e.status
                FROM agent_chat_execution_view e, target
                WHERE e.thread_id = $2
                  AND (
                    e.created_at < target.created_at
                    OR (e.created_at = target.created_at AND e.id <= target.id)
                  )
                ORDER BY e.created_at, e.id
                """,
                self._execution_id,
                self._thread_id,
                self._user_id,
            )
            message_ids: list[str] = []
            for row in rows:
                message_ids.append(str(row["user_message_id"]))
                if row["status"] == "completed" and row["assistant_message_id"] is not None:
                    message_ids.append(str(row["assistant_message_id"]))
            messages = await connection.fetch(
                """
                SELECT id, role, content, tool_calls, tool_call_id
                FROM agent_chat_message_view
                WHERE id = ANY($1::text[])
                """,
                message_ids,
            )
            facts = await connection.fetch(
                "SELECT key, content FROM chat_user_memories WHERE user_id = $1 ORDER BY key",
                self._user_id,
            )
        by_id = {str(row["id"]): row for row in messages}
        history = [_message(by_id[message_id]) for message_id in message_ids if message_id in by_id]
        summary = str(thread["summary"]) if thread["summary"] is not None else None
        if summary is not None and summary.strip():
            history = history[-RECENT_WITH_SUMMARY:]
        return history, summary, [ChatFact(key=str(row["key"]), content=str(row["content"])) for row in facts]


def _message(row: Any) -> ChatHistoryMessage:
    return ChatHistoryMessage.model_validate(
        {
            "role": row["role"],
            "content": row["content"],
            "toolCalls": row["tool_calls"] or [],
            "toolCallId": row["tool_call_id"],
        }
    )
