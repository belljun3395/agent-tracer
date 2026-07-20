"""task-cleanup의 사용자 범위 이벤트 조회 타입을 제공한다."""

from __future__ import annotations

from ..runtime.scoped_event_reader import ScopedEventReader

# 조회 로직이 title-suggestion과 완전히 같아 새 서브클래스 대신 이름만 이 슬라이스로 가져온다.
CleanupLedgerReader = ScopedEventReader
