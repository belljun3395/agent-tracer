"""task-cleanup의 사용자 범위 이벤트 조회 타입을 제공한다."""

from __future__ import annotations

from ..runtime.scoped_event_reader import ScopedEventReader


class CleanupLedgerReader(ScopedEventReader):
    """한 사용자의 원장 뷰만 읽도록 생성 시점에 범위가 묶인 조회 진입점이다."""

    pass
